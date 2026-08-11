// Payout math per incentive-plan.md (Tech Team Incentive Plan, effective 1 Apr 2026).
// Only the formally-specified rules are encoded here — the "Full Example"
// walkthrough in that doc contains numbers that don't match its own tables
// (e.g. a rating-of-7 quality payout shown as 90% there vs. 80% in the
// Quality Bonus table), so the tables are treated as the source of truth.

import { daysBetween } from "@/lib/format";
import type { Project, ProjectAssignee } from "@/lib/types";

/** 10% of every project value funds the tech team incentive pool. */
export const INCENTIVE_POOL_RATE = 0.1;

/**
 * Pool Split (10%): the 60% "Project Team Members" share is divided equally
 * across every head on the project — lead or member alike — and the 40%
 * "Project Lead" share is an additional bonus layered on top, divided equally
 * across however many Owners the project has.
 */
export const LEAD_BONUS_SHARE = 0.4;
export const TEAM_SHARE = 0.6;

/** Speed Bonus (A): each day of delay costs 2%, floored at 75% payout. */
export const SPEED_DEDUCTION_PER_DAY = 0.02;
export const SPEED_FACTOR_FLOOR = 0.75;

/** Project Ownership Incentive: flat ₹1,000 per head, per client, per testimonial. */
export const TESTIMONIAL_BONUS = 1000;

/** Quality Bonus (B): client rating (1-10) mapped to a payout multiplier. */
export function qualityFactor(rating: number): number {
  if (rating >= 8) return 1;
  if (rating === 7) return 0.8;
  if (rating === 6) return 0.5;
  return 0;
}

/** Speed Bonus (A): on-time/early is full payout; each late day costs 2%, floor 75%. */
export function speedFactor(delayDays: number): number {
  if (delayDays <= 0) return 1;
  return Math.max(1 - SPEED_DEDUCTION_PER_DAY * delayDays, SPEED_FACTOR_FLOOR);
}

/**
 * Delay measured at closure (actual vs. planned end of the development
 * phase) — distinct from `projects.dev_delay_days`, which is the
 * automation's ongoing daily estimate, per Supabase_Schema_Design.md's note
 * that the two are separate concepts.
 */
export function closureDelayDays(
  project: Pick<Project, "dev_end_date" | "actual_end_date">
): number {
  if (!project.actual_end_date) return 0;
  if (new Date(project.actual_end_date) <= new Date(project.dev_end_date)) return 0;
  return daysBetween(project.dev_end_date, project.actual_end_date);
}

export type AssigneePayout = {
  assignee: ProjectAssignee;
  /** This person's slice of the 60% team share (equal across every head). */
  teamSharePercent: number;
  teamShareAmount: number;
  /** This person's slice of the 40% lead bonus (0 unless they're an Owner). */
  leadBonusPercent: number;
  leadBonusAmount: number;
  testimonialBonus: number;
  totalPayout: number;
};

export type PayoutBreakdown = {
  projectValue: number;
  incentivePool: number;
  clientRating: number;
  delayDays: number;
  qualityFactor: number;
  speedFactor: number;
  finalPool: number;
  perAssignee: AssigneePayout[];
};

/**
 * Returns null until closure data (completion date + client rating) exists —
 * before that, the Speed and Quality Bonus factors aren't yet determined.
 */
export function computePayoutBreakdown(
  project: Project,
  assignees: ProjectAssignee[]
): PayoutBreakdown | null {
  if (!project.actual_end_date || project.client_rating === null) return null;

  const incentivePool = project.project_value * INCENTIVE_POOL_RATE;
  const delayDays = closureDelayDays(project);
  const quality = qualityFactor(project.client_rating);
  const speed = speedFactor(delayDays);
  const finalPool = incentivePool * quality * speed;

  const owners = assignees.filter((a) => a.payout_role === "Owner");

  const perAssignee: AssigneePayout[] = [];
  if (assignees.length > 0) {
    // No designated lead on this project — nobody to award the 40% bonus to,
    // so the whole pool folds into the equally-divided team share instead.
    const teamShare = owners.length > 0 ? TEAM_SHARE : 1;
    const teamSharePercent = teamShare / assignees.length;
    const leadBonusPercent = owners.length > 0 ? LEAD_BONUS_SHARE / owners.length : 0;

    for (const assignee of assignees) {
      const isOwner = assignee.payout_role === "Owner";
      const teamShareAmount = finalPool * teamSharePercent;
      const leadBonusAmount = isOwner ? finalPool * leadBonusPercent : 0;
      const testimonialBonus = assignee.testimonial_received ? TESTIMONIAL_BONUS : 0;
      perAssignee.push({
        assignee,
        teamSharePercent,
        teamShareAmount,
        leadBonusPercent: isOwner ? leadBonusPercent : 0,
        leadBonusAmount,
        testimonialBonus,
        totalPayout: teamShareAmount + leadBonusAmount + testimonialBonus,
      });
    }
  }

  return {
    projectValue: project.project_value,
    incentivePool,
    clientRating: project.client_rating,
    delayDays,
    qualityFactor: quality,
    speedFactor: speed,
    finalPool,
    perAssignee,
  };
}
