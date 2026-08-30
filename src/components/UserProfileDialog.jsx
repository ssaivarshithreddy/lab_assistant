import { useState, useEffect } from "react";
import { User, KeyRound, Save, Loader2, Mail, Calendar, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/features/auth/AuthProvider";
import { apiClient } from "@/lib/apiClient";

export function UserProfileDialog({ open, onOpenChange }) {
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);

  const handleQuickRoleSwitch = async () => {
    if (!user?.id) return;
    const targetRole = user.role === "admin" ? "user" : "admin";
    setSwitchingRole(true);
    try {
      const res = await apiClient.updateUserRole(user.id, targetRole);
      if (res?.user && res?.token) {
        updateUser(res.user, res.token);
        toast.success(`Instantly switched role to ${targetRole.toUpperCase()}!`);
      } else {
        toast.error(res?.error || "Failed to switch role");
      }
    } catch (err) {
      toast.error(err.message || "Role switch failed");
    } finally {
      setSwitchingRole(false);
    }
  };

  useEffect(() => {
    if (user && open) {
      setFullName(user.full_name || "");
      setPhoneNumber(user.phone_number || "");
    }
  }, [user, open]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Full name cannot be empty.");
      return;
    }

    setSavingProfile(true);
    try {
      const res = await apiClient.updateProfile({
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim(),
      });
      if (res?.user) {
        updateUser(res.user, res.token);
      }
      toast.success(res?.message || "Profile updated successfully!");
    } catch (err) {
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Current password is required.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await apiClient.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success(res?.message || "Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err.message || "Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <User className="h-5 w-5 text-primary" /> Profile & Account Settings
          </DialogTitle>
          <DialogDescription>
            Manage your personal profile, contact information, and security credentials.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* User Summary */}
          <div className="flex items-center gap-4 rounded-xl border bg-accent/40 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary text-lg font-bold text-primary-foreground">
              {(fullName || user?.email || "U").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-base truncate">{fullName || "User"}</span>
                <Badge variant={user?.role === "admin" ? "default" : "secondary"} className="capitalize text-xs">
                  {user?.role || "user"}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={switchingRole}
                  onClick={handleQuickRoleSwitch}
                  className="h-6 text-[11px] px-2 flex items-center gap-1 border-primary/30 hover:bg-primary/10 ml-auto"
                >
                  {switchingRole ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3 text-primary" />}
                  Switch to {user?.role === "admin" ? "User" : "Admin"} Mode
                </Button>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 truncate">
                <Mail className="h-3.5 w-3.5 shrink-0" /> {user?.email}
              </div>
              {user?.phone_number && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 truncate">
                  <Phone className="h-3.5 w-3.5 shrink-0" /> {user.phone_number}
                </div>
              )}
              {user?.created_at && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                  <Calendar className="h-3.5 w-3.5 shrink-0" /> Member since {new Date(user.created_at).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Update Name & Phone Form */}
          <form onSubmit={handleUpdateProfile} className="space-y-3 rounded-lg border p-4">
            <div className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Personal Information
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="profileName">
                  Full Name
                </label>
                <Input
                  id="profileName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="profilePhone">
                  Phone Number
                </label>
                <Input
                  id="profilePhone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 000-0000 or +91 9876543210"
                />
              </div>
            </div>
            <Button type="submit" size="sm" disabled={savingProfile} className="bg-gradient-primary w-full sm:w-auto mt-2">
              {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </form>

          {/* Security & Password Change */}
          <form onSubmit={handleChangePassword} className="space-y-3 rounded-lg border p-4">
            <div className="text-sm font-semibold flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" /> Change Password
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current Password"
                required
              />
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New Password (min 8 chars)"
                required
              />
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm New Password"
                required
              />
            </div>
            <Button type="submit" size="sm" variant="outline" disabled={savingPassword} className="w-full sm:w-auto mt-2">
              {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Update Password
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
