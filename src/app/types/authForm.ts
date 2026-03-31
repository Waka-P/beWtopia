export const LOGIN_STEPS = ["email", "password"] as const;
export const SIGNUP_STEPS = [
  "email",
  "name",
  "password",
  "confirmPassword",
] as const;
export const RESET_PASSWORD_STEPS = ["password", "confirmPassword"] as const;
export type LoginStep = (typeof LOGIN_STEPS)[number];
export type SignUpStep = (typeof SIGNUP_STEPS)[number];
export type ResetPasswordStep = (typeof RESET_PASSWORD_STEPS)[number];
export type Step = LoginStep | SignUpStep | ResetPasswordStep;
