import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = {
  title: "Reset password",
};

export default async function ResetPasswordPage({ searchParams }) {
  const token = (await searchParams)?.token;
  return (
    <AuthShell
      title="Set a new password"
      description="Choose a new password for your account. It must be at least 8 characters."
    >
      <ResetPasswordForm token={typeof token === "string" ? token : ""} />
    </AuthShell>
  );
}
