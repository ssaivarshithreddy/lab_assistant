import { useState, useEffect } from "react";
import { 
  User, KeyRound, Save, Loader2, Mail, Calendar, Phone, ShieldCheck 
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/features/auth/AuthProvider";
import { apiClient } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

export function UserProfileDialog({ open, onOpenChange }) {
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Email Verification state
  const [emailOtp, setEmailOtp] = useState("");
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [verifyingEmailOtp, setVerifyingEmailOtp] = useState(false);
  const [showEmailOtpInput, setShowEmailOtpInput] = useState(false);

  // Phone Verification state
  const [phoneOtp, setPhoneOtp] = useState("");
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [verifyingPhoneOtp, setVerifyingPhoneOtp] = useState(false);
  const [showPhoneOtpInput, setShowPhoneOtpInput] = useState(false);

  // 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.two_factor_enabled || false);
  const [toggling2FA, setToggling2FA] = useState(false);

  useEffect(() => {
    if (user && open) {
      setFullName(user.full_name || "");
      setPhoneNumber(user.phone_number || "");
      setTwoFactorEnabled(Boolean(user.two_factor_enabled));
    }
  }, [user, open]);

  const handleSendEmailOtp = async () => {
    setSendingEmailOtp(true);
    try {
      const res = await apiClient.sendEmailOtp();
      toast.success(res?.message || "Verification code dispatched to your email!");
      setShowEmailOtpInput(true);
    } catch (err) {
      toast.error(err.message || "Failed to send email OTP");
    } finally {
      setSendingEmailOtp(false);
    }
  };

  const handleVerifyEmailOtp = async (e) => {
    e.preventDefault();
    if (!emailOtp.trim()) return toast.error("Enter verification code");
    setVerifyingEmailOtp(true);
    try {
      const res = await apiClient.verifyEmailOtp(emailOtp.trim());
      toast.success(res?.message || "Email address verified successfully!");
      if (res?.success) {
        updateUser({ ...user, email_verified: true });
        setShowEmailOtpInput(false);
      }
    } catch (err) {
      toast.error(err.message || "Invalid or expired code");
    } finally {
      setVerifyingEmailOtp(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    if (!phoneNumber) return toast.error("Please enter a phone number first.");
    setSendingPhoneOtp(true);
    try {
      const res = await apiClient.sendPhoneOtp(phoneNumber.trim());
      toast.success(res?.message || "Phone verification code sent!");
      setShowPhoneOtpInput(true);
    } catch (err) {
      toast.error(err.message || "Failed to send phone OTP");
    } finally {
      setSendingPhoneOtp(false);
    }
  };

  const handleVerifyPhoneOtp = async (e) => {
    e.preventDefault();
    if (!phoneOtp.trim()) return toast.error("Enter phone verification code");
    setVerifyingPhoneOtp(true);
    try {
      const res = await apiClient.verifyPhoneOtp({ phone_number: phoneNumber.trim(), code: phoneOtp.trim() });
      toast.success(res?.message || "Phone number verified successfully!");
      if (res?.success) {
        updateUser({ ...user, phone_verified: true, phone_number: phoneNumber.trim() });
        setShowPhoneOtpInput(false);
      }
    } catch (err) {
      toast.error(err.message || "Invalid or expired code");
    } finally {
      setVerifyingPhoneOtp(false);
    }
  };

  const handleToggle2FA = async (targetState) => {
    setToggling2FA(true);
    try {
      const res = await apiClient.toggle2Fa(targetState);
      toast.success(res?.message || `Two-Factor Security updated!`);
      setTwoFactorEnabled(targetState);
      updateUser({ ...user, two_factor_enabled: targetState });
    } catch (err) {
      toast.error(err.message || "Failed to update 2FA setting");
    } finally {
      setToggling2FA(false);
    }
  };

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
      <DialogContent className="max-w-lg sm:max-w-xl p-0 border-border bg-card/95 backdrop-blur-2xl rounded-3xl overflow-hidden shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>User Profile & Account Settings</DialogTitle>
          <DialogDescription>Manage your LabSense profile, credentials, and permissions.</DialogDescription>
        </DialogHeader>

        {/* Hero Profile Banner */}
        <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-6 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent)] pointer-events-none" />
          
          <div className="relative flex items-center gap-5">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white font-black text-2xl shadow-xl backdrop-blur-md border border-white/30">
              {(fullName || user?.email || "U").slice(0, 2).toUpperCase()}
              <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-400 border-2 border-indigo-700" title="Active" />
            </div>

            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-extrabold text-white tracking-tight truncate">{fullName || "LabSense User"}</h3>
                <Badge className={cn(
                  "uppercase text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full border shadow-sm",
                  user?.role === "admin" 
                    ? "bg-amber-400 text-amber-950 border-amber-300" 
                    : "bg-white/20 text-white border-white/30 backdrop-blur-md"
                )}>
                  {user?.role === "admin" ? "Admin" : "Standard User"}
                </Badge>
              </div>

              <div className="flex items-center gap-3 text-xs text-white/80 flex-wrap">
                <span className="flex items-center gap-1 truncate">
                  <Mail className="h-3.5 w-3.5 text-white/90" /> {user?.email}
                </span>
                {user?.created_at && (
                  <span className="flex items-center gap-1 opacity-90">
                    <Calendar className="h-3.5 w-3.5" /> Joined {new Date(user.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabbed Content Navigation */}
        <Tabs defaultValue="profile" className="p-6 pt-4 space-y-5">
          <TabsList className="grid w-full grid-cols-2 bg-muted/60 p-1 rounded-2xl border border-border">
            <TabsTrigger value="profile" className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <User className="h-3.5 w-3.5 text-indigo-500" /> Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" /> Security
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: PERSONAL & CONTACT */}
          <TabsContent value="profile" className="space-y-4 m-0 focus-visible:outline-none">
            {/* Contact Verification Badges Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Email Status Card */}
              <div className="rounded-2xl border border-border bg-muted/30 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-indigo-500" /> Email Verification
                  </span>
                  {user?.email_verified ? (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold">
                      Verified ✓
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold">
                      Unverified
                    </Badge>
                  )}
                </div>

                {!user?.email_verified && (
                  <div className="pt-1">
                    {!showEmailOtpInput ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={sendingEmailOtp}
                        onClick={handleSendEmailOtp}
                        className="w-full h-8 text-xs font-bold border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20 rounded-xl"
                      >
                        {sendingEmailOtp ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
                        Send Email OTP
                      </Button>
                    ) : (
                      <form onSubmit={handleVerifyEmailOtp} className="flex items-center gap-2">
                        <Input
                          type="text"
                          maxLength={6}
                          value={emailOtp}
                          onChange={(e) => setEmailOtp(e.target.value)}
                          placeholder="6-digit OTP"
                          className="h-8 text-xs font-mono text-center rounded-xl bg-card border-border"
                          required
                        />
                        <Button type="submit" size="sm" disabled={verifyingEmailOtp} className="h-8 text-xs font-bold bg-indigo-600 text-white rounded-xl shrink-0">
                          {verifyingEmailOtp ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
                        </Button>
                      </form>
                    )}
                  </div>
                )}
              </div>

              {/* Phone Status Card */}
              <div className="rounded-2xl border border-border bg-muted/30 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-emerald-500" /> Phone Verification
                  </span>
                  {user?.phone_verified ? (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold">
                      Verified ✓
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold">
                      Unverified
                    </Badge>
                  )}
                </div>

                {phoneNumber && !user?.phone_verified && (
                  <div className="pt-1">
                    {!showPhoneOtpInput ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={sendingPhoneOtp}
                        onClick={handleSendPhoneOtp}
                        className="w-full h-8 text-xs font-bold border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20 rounded-xl"
                      >
                        {sendingPhoneOtp ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
                        Send Phone SMS
                      </Button>
                    ) : (
                      <form onSubmit={handleVerifyPhoneOtp} className="flex items-center gap-2">
                        <Input
                          type="text"
                          maxLength={6}
                          value={phoneOtp}
                          onChange={(e) => setPhoneOtp(e.target.value)}
                          placeholder="6-digit OTP"
                          className="h-8 text-xs font-mono text-center rounded-xl bg-card border-border"
                          required
                        />
                        <Button type="submit" size="sm" disabled={verifyingPhoneOtp} className="h-8 text-xs font-bold bg-emerald-600 text-white rounded-xl shrink-0">
                          {verifyingPhoneOtp ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
                        </Button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Edit Profile Form */}
            <form onSubmit={handleUpdateProfile} className="space-y-4 rounded-2xl border border-border bg-card p-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5" htmlFor="profileName">
                    <User className="h-3.5 w-3.5 text-indigo-500" /> Full Name
                  </label>
                  <Input
                    id="profileName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter full name"
                    className="h-10 text-xs rounded-xl bg-muted/40 border-border focus-visible:ring-indigo-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5" htmlFor="profilePhone">
                    <Phone className="h-3.5 w-3.5 text-emerald-500" /> Contact Phone Number
                  </label>
                  <Input
                    id="profilePhone"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 (555) 000-0000 or +91 9876543210"
                    className="h-10 text-xs rounded-xl bg-muted/40 border-border focus-visible:ring-indigo-500"
                  />
                </div>
              </div>

              <Button type="submit" disabled={savingProfile} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs h-9 shadow-md glow-indigo">
                {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Personal Details
              </Button>
            </form>
          </TabsContent>

          {/* TAB 2: SECURITY & 2FA */}
          <TabsContent value="security" className="space-y-4 m-0 focus-visible:outline-none">
            {/* Two-Factor Security Control */}
            <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-indigo-500" />
                  <div>
                    <div className="text-xs font-extrabold text-foreground">Two-Factor Security (2FA)</div>
                    <div className="text-[11px] text-muted-foreground">OTP verification required at login</div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant={twoFactorEnabled ? "destructive" : "default"}
                  size="sm"
                  disabled={toggling2FA}
                  onClick={() => handleToggle2FA(!twoFactorEnabled)}
                  className="h-8 text-xs font-bold rounded-xl px-4"
                >
                  {toggling2FA ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  {twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {twoFactorEnabled
                  ? "🔒 Two-Factor Protection is ACTIVE. A security verification OTP will be required on each sign-in."
                  : "Enable 2FA to protect your medical lab account with mandatory security codes on login."}
              </p>
            </div>

            {/* Change Password Form */}
            <form onSubmit={handleChangePassword} className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="text-xs font-extrabold text-foreground flex items-center gap-1.5 pb-1">
                <KeyRound className="h-4 w-4 text-indigo-500" /> Change Security Password
              </div>
              <div className="space-y-2">
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current Password"
                  className="h-9 text-xs rounded-xl bg-muted/40 border-border"
                  required
                />
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New Password (min 8 chars)"
                  className="h-9 text-xs rounded-xl bg-muted/40 border-border"
                  required
                />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm New Password"
                  className="h-9 text-xs rounded-xl bg-muted/40 border-border"
                  required
                />
              </div>
              <Button type="submit" variant="outline" disabled={savingPassword} className="w-full text-xs font-bold rounded-xl h-9 border-border bg-muted/30">
                {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4 text-indigo-500" />}
                Update Account Password
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
