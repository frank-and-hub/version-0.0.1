"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Badge } from "@/components/ui/Badge";
import {
  User as UserIcon,
  Shield,
  KeyRound,
  Save,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Mail,
  Phone,
  MapPin,
  Image,
} from "lucide-react";

export default function AdminProfilePage() {
  const { user, refreshUser } = useAuth();

  // Profile Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [profilePictureUrl, setProfilePictureUrl] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || user.first_name || "");
      setLastName(user.lastName || user.last_name || "");
      setPhoneNumber(user.phoneNumber || user.phone_number || "");
      setAddress(user.address || "");
      setProfilePictureUrl(
        user.profilePictureUrl || user.profile_picture_url || "",
      );
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setProfileSuccess(null);
    setProfileError(null);

    try {
      await api.patch("/users/profile/me", {
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber,
        address,
        profile_picture_url: profilePictureUrl,
      });

      setProfileSuccess("Profile details updated successfully!");
      if (refreshUser) await refreshUser();
      setTimeout(() => setProfileSuccess(null), 3000);
    } catch (err: any) {
      setProfileError(err.message || "Failed to update profile");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password do not match");
      return;
    }

    setIsChangingPassword(true);

    try {
      await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });

      setPasswordSuccess("Password successfully changed!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Breadcrumbs & Header */}
      <div>
        <Breadcrumbs
          items={[
            { label: "Admin", href: "/admin/dashboard" },
            { label: "Profile & Security" },
          ]}
        />
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2 mt-2">
          <UserIcon className="w-6 h-6 text-indigo-600" />
          Admin Profile & Security
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your administrative profile information, contact details, and
          authentication credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Account Summary Card */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-white p-6 rounded-xl border border-slate-200 btn hadow-sm flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-md mb-4 overflow-hidden">
              {profilePictureUrl ? (
                <img
                  src={profilePictureUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{user?.first_name?.charAt(0) || "A"}</span>
              )}
            </div>

            <h3 className="font-bold text-slate-900 text-lg">
              {user?.first_name} {user?.last_name}
            </h3>
            <p className="text-xs text-slate-500 mb-3">{user?.email}</p>

            <div className="flex items-center gap-1.5 mb-4">
              <Badge variant="indigo">{user?.role}</Badge>
              <Badge variant="success">{user?.status}</Badge>
            </div>

            <div className="w-full pt-4 border-t border-slate-100 text-left space-y-2 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">
                  User UUID
                </span>
                <span className="font-mono text-slate-700 text-[11px] break-all">
                  {user?.user_uuid}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">
                  Last Login
                </span>
                <span className="text-slate-700">
                  {user?.last_login_at
                    ? new Date(user.last_login_at).toLocaleString()
                    : "Never"}
                </span>
              </div>
            </div>
          </div>

          {/* Granular Permissions Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 btn hadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Active Permissions
              </h4>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {user?.permissions && user.permissions.length > 0 ? (
                user.permissions.map((perm) => (
                  <span
                    key={perm}
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-50 text-indigo-700 border border-indigo-200"
                  >
                    {perm}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400 italic">
                  {user?.role === "SUPER_ADMIN"
                    ? "SUPER_ADMIN (Bypasses all checks)"
                    : "No permissions assigned"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Forms */}
        <div className="space-y-6 lg:col-span-2">
          {/* Profile Form */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 btn hadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <UserIcon className="w-4 h-4 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">
                Personal Details
              </h2>
            </div>

            {profileSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none "
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none "
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="w-full text-sm rounded-lg border border-slate-200 pl-9 pr-3 py-2 bg-slate-50 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Email changes require administrator escalation for security.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full text-sm rounded-lg border border-slate-200 pl-9 pr-3 py-2 focus:outline-none "
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Address
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="City, State, Country"
                      className="w-full text-sm rounded-lg border border-slate-200 pl-9 pr-3 py-2 focus:outline-none "
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Profile Picture URL
                </label>
                <div className="relative">
                  <Image className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="url"
                    value={profilePictureUrl}
                    onChange={(e) => setProfilePictureUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full text-sm rounded-lg border border-slate-200 pl-9 pr-3 py-2 focus:outline-none "
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isUpdatingProfile}
                  className="flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {isUpdatingProfile ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </form>
          </div>

          {/* Password Change Form */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 btn hadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <KeyRound className="w-4 h-4 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">
                Change Password
              </h2>
            </div>

            {passwordSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full text-sm rounded-lg border border-slate-200 pl-9 pr-3 py-2 focus:outline-none "
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="Min. 8 characters"
                      className="w-full text-sm rounded-lg border border-slate-200 pl-9 pr-3 py-2 focus:outline-none "
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••••••"
                      className="w-full text-sm rounded-lg border border-slate-200 pl-9 pr-3 py-2 focus:outline-none "
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isChangingPassword}
                  className="flex items-center gap-1.5"
                >
                  <KeyRound className="w-4 h-4" />
                  {isChangingPassword
                    ? "Updating Password..."
                    : "Update Password"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
