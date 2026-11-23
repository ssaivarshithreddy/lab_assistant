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
  const [showPasscodeSetup, setShowPasscodeSetup] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [confirmPasscodeInput, setConfirmPasscodeInput] = useState("");
  const [currentPasscodeInput, setCurrentPasscodeInput] = useState("");
  const [showChangePasscode, setShowChangePasscode] = useState(false);

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

  const handleEnable2FAPasscode = async (e) => {
    e.preventDefault();
    if (!passcodeInput || passcodeInput.trim().length < 4) {
      toast.error("Passcode (PIN) must be between 4 and 6 digits.");
      return;
    }
    if (passcodeInput !== confirmPasscodeInput) {
      toast.error("Passcodes do not match.");
      return;
    }

    setToggling2FA(true);
    try {
      const res = await apiClient.toggle2Fa({ enabled: true, passcode: passcodeInput.trim() });
      toast.success(res?.message || "Passcode 2FA enabled successfully!");
      setTwoFactorEnabled(true);
      updateUser({ ...user, two_factor_enabled: true });
      setShowPasscodeSetup(false);
      setPasscodeInput("");
      setConfirmPasscodeInput("");
    } catch (err) {
      toast.error(err.message || "Failed to enable 2FA passcode");
    } finally {
      setToggling2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    setToggling2FA(true);
    try {
      const res = await apiClient.toggle2Fa({ enabled: false });
      toast.success(res?.message || "2FA disabled successfully");
      setTwoFactorEnabled(false);
      updateUser({ ...user, two_factor_enabled: false });
      setShowChangePasscode(false);
    } catch (err) {
      toast.error(err.message || "Failed to disable 2FA");
    } finally {
      setToggling2FA(false);
    }
  };

  const handleChangePasscode = async (e) => {
    e.preventDefault();
    if (!passcodeInput || passcodeInput.trim().length < 4) {
      toast.error("New passcode (PIN) must be between 4 and 6 digits.");
      return;
    }
    if (passcodeInput !== confirmPasscodeInput) {
      toast.error("New passcodes do not match.");
      return;
    }

    setToggling2FA(true);
    try {
      const res = await apiClient.set2FaPasscode({
        passcode: passcodeInput.trim(),
        current_passcode: currentPasscodeInput.trim() || undefined,
      });
      toast.success(res?.message || "Passcode updated successfully!");
      setShowChangePasscode(false);
      setCurrentPasscodeInput("");
      setPasscodeInput("");
      setConfirmPasscodeInput("");
    } catch (err) {
      toast.error(err.message || "Failed to update passcode");
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
            {/* Two-Factor Passcode Security Control */}
            <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-indigo-500" />
                  <div>
                    <div className="text-xs font-extrabold text-foreground">Two-Factor Security (Passcode PIN)</div>
                    <div className="text-[11px] text-muted-foreground">Personal 4-6 digit PIN required at login (no email needed)</div>
                  </div>
                </div>
                {twoFactorEnabled ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={toggling2FA}
                    onClick={handleDisable2FA}
                    className="h-8 text-xs font-bold rounded-xl px-4"
                  >
                    {toggling2FA ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Disable 2FA
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    disabled={toggling2FA}
                    onClick={() => setShowPasscodeSetup((s) => !s)}
                    className="h-8 text-xs font-bold rounded-xl px-4 bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    {showPasscodeSetup ? "Cancel" : "Enable Passcode 2FA"}
                  </Button>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {twoFactorEnabled
                  ? "🔒 Passcode 2FA is ACTIVE. You will be prompted for your personal PIN on each sign-in."
                  : "Protect your medical lab account with an offline Security PIN on login. No external SMS or email required."}
              </p>

              {/* Passcode Setup Form when enabling 2FA */}
              {showPasscodeSetup && !twoFactorEnabled && (
                <form onSubmit={handleEnable2FAPasscode} className="space-y-2.5 pt-2 border-t border-border/60">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-foreground">Set 4-6 Digit PIN</label>
                      <Input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={passcodeInput}
                        onChange={(e) => setPasscodeInput(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="e.g. 123456"
                        required
                        className="h-8 text-xs font-mono tracking-widest text-center rounded-xl bg-background border-border"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-foreground">Confirm PIN</label>
                      <Input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={confirmPasscodeInput}
                        onChange={(e) => setConfirmPasscodeInput(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="Confirm PIN"
                        required
                        className="h-8 text-xs font-mono tracking-widest text-center rounded-xl bg-background border-border"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={toggling2FA}
                    className="w-full h-8 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm"
                  >
                    {toggling2FA ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ShieldCheck className="h-3 w-3 mr-1" />}
                    Save PIN & Activate 2FA
                  </Button>
                </form>
              )}

              {/* Option to change passcode when 2FA is already active */}
              {twoFactorEnabled && (
                <div className="pt-2 border-t border-border/60">
                  {!showChangePasscode ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowChangePasscode(true)}
                      className="h-7 text-xs text-indigo-500 hover:text-indigo-400 p-0"
                    >
                      Need to change your Security PIN? Click here
                    </Button>
                  ) : (
                    <form onSubmit={handleChangePasscode} className="space-y-2.5 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-foreground">Current PIN</label>
                          <Input
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            value={currentPasscodeInput}
                            onChange={(e) => setCurrentPasscodeInput(e.target.value.replace(/[^0-9]/g, ""))}
                            placeholder="Current PIN"
                            className="h-8 text-xs font-mono tracking-widest text-center rounded-xl bg-background border-border"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-foreground">New PIN</label>
                          <Input
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            value={passcodeInput}
                            onChange={(e) => setPasscodeInput(e.target.value.replace(/[^0-9]/g, ""))}
                            placeholder="New PIN"
                            required
                            className="h-8 text-xs font-mono tracking-widest text-center rounded-xl bg-background border-border"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-foreground">Confirm New</label>
                          <Input
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            value={confirmPasscodeInput}
                            onChange={(e) => setConfirmPasscodeInput(e.target.value.replace(/[^0-9]/g, ""))}
                            placeholder="Confirm"
                            required
                            className="h-8 text-xs font-mono tracking-widest text-center rounded-xl bg-background border-border"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="submit"
                          size="sm"
                          disabled={toggling2FA}
                          className="h-8 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex-1"
                        >
                          {toggling2FA ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          Update Security PIN
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowChangePasscode(false);
                            setCurrentPasscodeInput("");
                            setPasscodeInput("");
                            setConfirmPasscodeInput("");
                          }}
                          className="h-8 text-xs rounded-xl"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}
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
