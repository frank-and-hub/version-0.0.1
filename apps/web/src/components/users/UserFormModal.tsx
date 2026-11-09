'use client';

import React, { useState, useEffect } from 'react';
import { User, UserRole, UserStatus, CreateUserDto, UpdateUserDto } from '@monorepo/shared-types';
import { api } from '@/lib/api';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateUserDto | UpdateUserDto) => Promise<void>;
  user?: User | null;
  isLoading?: boolean;
}

export const UserFormModal: React.FC<UserFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  user,
  isLoading = false,
}) => {
  const isEditing = !!user;

  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    address: '',
    password: '',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availableRoles, setAvailableRoles] = useState<Array<{ label: string; value: string }>>([
    { label: 'Standard User (USER)', value: UserRole.USER },
    { label: 'Moderator (MODERATOR)', value: UserRole.MODERATOR },
    { label: 'Administrator (ADMIN)', value: UserRole.ADMIN },
    { label: 'Super Administrator (SUPER_ADMIN)', value: UserRole.SUPER_ADMIN },
  ]);

  useEffect(() => {
    async function loadRoles() {
      try {
        const roles = await api.get<any[]>('/roles');
        if (Array.isArray(roles) && roles.length > 0) {
          setAvailableRoles(
            roles.map((r) => ({
              label: `${r.name} (${r.code})`,
              value: r.code,
            })),
          );
        }
      } catch {
        // Fall back to default roles
      }
    }
    if (isOpen) {
      loadRoles();
    }
  }, [isOpen]);

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone_number || '',
        address: user.address || '',
        password: '',
        role: user.role,
        status: user.status,
      });
    } else {
      setFormData({
        email: '',
        first_name: '',
        last_name: '',
        phone_number: '',
        address: '',
        password: '',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      });
    }
    setErrors({});
  }, [user, isOpen]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.email || !formData.email.includes('@')) {
      errs.email = 'Valid email is required';
    }
    if (!formData.first_name.trim()) {
      errs.first_name = 'First name is required';
    }
    if (!formData.last_name.trim()) {
      errs.last_name = 'Last name is required';
    }
    if (!isEditing && (!formData.password || formData.password.length < 8)) {
      errs.password = 'Password must be at least 8 characters long';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: any = {
      email: formData.email,
      first_name: formData.first_name,
      last_name: formData.last_name,
      phone_number: formData.phone_number || undefined,
      address: formData.address || undefined,
      role: formData.role,
      status: formData.status,
    };

    if (formData.password) {
      payload.password = formData.password;
    }

    try {
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setErrors({ form: err.message || 'Operation failed' });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit User Details' : 'Create New User'}
      description={
        isEditing
          ? 'Update permissions, status, or identity for this account.'
          : 'Add a new member with assigned RBAC role.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.form && (
          <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
            {errors.form}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First Name"
            value={formData.first_name}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            placeholder="John"
            error={errors.first_name}
            required
          />
          <Input
            label="Last Name"
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            placeholder="Doe"
            error={errors.last_name}
            required
          />
        </div>

        <Input
          label="Email Address"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="john.doe@example.com"
          error={errors.email}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Phone Number"
            value={formData.phone_number}
            onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
            placeholder="+1 (555) 000-0000"
          />
          <Input
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="City, Country"
          />
        </div>

        <Input
          label={isEditing ? 'New Password (optional)' : 'Password'}
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          placeholder={isEditing ? 'Leave blank to preserve existing password' : 'Min 8 characters'}
          error={errors.password}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Role (RBAC)"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
            options={availableRoles}
          />

          <Select
            label="Status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as UserStatus })}
            options={[
              { label: 'Active', value: UserStatus.ACTIVE },
              { label: 'Inactive', value: UserStatus.INACTIVE },
              { label: 'Suspended', value: UserStatus.SUSPENDED },
            ]}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>
            {isEditing ? 'Save Changes' : 'Create User'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
