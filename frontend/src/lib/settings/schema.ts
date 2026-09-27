import { z } from "zod";

export const profileSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(80, "Full name must be under 80 characters"),
  email: z.string().email("Please enter a valid email address"),
  organization: z.string().max(120, "Organization must be under 120 characters").optional().nullable().or(z.literal("")),
  avatar: z.string().optional().nullable().or(z.literal("")),
});

export const notificationSchema = z.object({
  critical: z.boolean(),
  weeklyDigest: z.boolean(),
  droneUpdates: z.boolean(),
  emergency: z.boolean(),
  oceanHealth: z.boolean(),
  speciesMonitoring: z.boolean(),
  aiRecommendations: z.boolean(),
  missionStatus: z.boolean(),
  email: z.boolean(),
  push: z.boolean(),
  sms: z.boolean().optional(),
});

export const settingsSchema = z.object({
  profile: profileSchema,
  notifications: notificationSchema,
  region: z.string().min(1),
  theme: z.enum(["dark", "light", "system"]),
});

export type Settings = z.infer<typeof settingsSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Notifications = z.infer<typeof notificationSchema>;
