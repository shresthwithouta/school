import { notFound } from "next/navigation";
import { Mail, Phone, Building2, CalendarDays } from "lucide-react";

import { requireUser } from "@/lib/session";
import { getUserByIdForActor } from "@/lib/users";
import { formatDate, getInitials } from "@/lib/utils";

import { TierBadge, RoleBadge } from "@/components/role-badge";
import { ProfileForm } from "@/components/profile/profile-form";
import { PasswordForm } from "@/components/profile/password-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireUser();
  const me = await getUserByIdForActor(session, session.id);
  if (!me) notFound();

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar className="size-20">
            <AvatarImage src={me.avatarUrl || undefined} alt={me.name} />
            <AvatarFallback className="bg-primary/10 text-xl text-primary">
              {getInitials(me.name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold tracking-tight">{me.name}</h3>
              <TierBadge role={me.role} />
              <RoleBadge role={me.role} />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-4" /> {me.email}
              </span>
              {me.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-4" /> {me.phone}
                </span>
              )}
              {me.department && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="size-4" /> {me.department}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" /> Joined {formatDate(me.createdAt)}
              </span>
            </div>
            {me.bio && (
              <p className="max-w-2xl text-sm text-muted-foreground">{me.bio}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Personal details</CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileForm user={me} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
            </CardHeader>
            <CardContent>
              <PasswordForm />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
