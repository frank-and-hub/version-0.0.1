import { PrismaClient, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive database seeding...');

  // Clean existing tables
  await prisma.whatsAppMessage.deleteMany({});
  await prisma.whatsAppConversation.deleteMany({});
  await prisma.whatsAppTemplate.deleteMany({});
  await prisma.emailAttachment.deleteMany({});
  await prisma.messageRecipient.deleteMany({});
  await prisma.emailMessage.deleteMany({});
  await prisma.emailTemplate.deleteMany({});
  await prisma.userProviderConfiguration.deleteMany({});
  await prisma.provider.deleteMany({});
  await prisma.rolePermission.deleteMany({});
  await prisma.permission.deleteMany({});
  await prisma.menuItem.deleteMany({});
  await prisma.setting.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.userActivityLog.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Seed Granular Permissions
  const permissionsList = [
    { code: 'users.read', name: 'View Users', category: 'User Management', description: 'Can read user profiles and lists' },
    { code: 'users.create', name: 'Create Users', category: 'User Management', description: 'Can create new users' },
    { code: 'users.update', name: 'Update Users', category: 'User Management', description: 'Can update user profiles and status' },
    { code: 'users.delete', name: 'Delete Users', category: 'User Management', description: 'Can delete users' },
    { code: 'users.view_activity', name: 'View User Activity', category: 'User Management', description: 'Can inspect user activity logs' },
    { code: 'roles.manage', name: 'Manage Roles', category: 'Access Control', description: 'Can create and assign roles' },
    { code: 'permissions.manage', name: 'Manage Permissions', category: 'Access Control', description: 'Can configure system permissions' },
    { code: 'navigation.manage', name: 'Manage Navigation', category: 'System', description: 'Can edit sidebar items and menu hierarchy' },
    { code: 'audit_logs.read', name: 'View Audit Logs', category: 'Audit & Compliance', description: 'Can read structured PostgreSQL audit records' },
    { code: 'error_logs.read', name: 'View Error Logs', category: 'Audit & Compliance', description: 'Can inspect MongoDB application error logs' },
    { code: 'settings.manage', name: 'Manage Settings', category: 'System', description: 'Can update application default settings' },
    { code: 'moderators.manage', name: 'Manage Moderators', category: 'Access Control', description: 'Can assign and supervise moderators' },
    { code: 'messaging.manage', name: 'Manage Messaging', category: 'Messaging', description: 'Can configure providers, send messages, and manage all messaging operations' },
    { code: 'messaging.messages', name: 'View & Send Messages', category: 'Messaging', description: 'Can inspect message history and send direct messages' },
    { code: 'messaging.campaigns', name: 'Manage Campaigns', category: 'Messaging', description: 'Can create and execute broadcast campaigns' },
    { code: 'messaging.contacts', name: 'Manage Contacts', category: 'Messaging', description: 'Can manage contact lists and audience groups' },
    { code: 'messaging.templates', name: 'Manage Templates', category: 'Messaging', description: 'Can create and edit multi-channel message templates' },
    { code: 'messaging.providers', name: 'Manage Providers', category: 'Messaging', description: 'Can connect and configure messaging providers' },
    { code: 'messaging.analytics', name: 'View Analytics', category: 'Messaging', description: 'Can view delivery rates, open rates, and performance analytics' },
    { code: 'messaging.webhooks', name: 'Webhook Monitoring', category: 'Messaging', description: 'Can monitor provider status callbacks and events' },
    { code: 'messaging.settings', name: 'Messaging Settings', category: 'Messaging', description: 'Can configure default messaging channels and rate limits' },
  ];

  const createdPermissions = new Map<string, string>();
  for (const p of permissionsList) {
    const created = await prisma.permission.create({
      data: {
        code: p.code,
        name: p.name,
        category: p.category,
        description: p.description,
      },
    });
    createdPermissions.set(p.code, created.permission_uuid);
  }

  // 2. Seed Dynamic Roles Table and Map Permissions
  const coreRoles = [
    { code: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full unrestricted system clearance across all system modules', is_system: true },
    { code: 'ADMIN', name: 'Administrator', description: 'System-wide operational administration and monitoring', is_system: true },
    { code: 'MODERATOR', name: 'Moderator', description: 'Community moderation and user activity supervision', is_system: true },
    { code: 'USER', name: 'Standard User', description: 'Standard authenticated member', is_system: true },
  ];

  const roleMap = new Map<string, string>();
  for (const r of coreRoles) {
    const createdRole = await prisma.roleDefinition.create({
      data: {
        code: r.code,
        name: r.name,
        description: r.description,
        is_system: r.is_system,
      },
    });
    roleMap.set(r.code, createdRole.role_uuid);
  }

  // SUPER_ADMIN has ALL permissions
  const saRoleUuid = roleMap.get('SUPER_ADMIN')!;
  for (const permUuid of createdPermissions.values()) {
    await prisma.rolePermission.create({
      data: {
        role_uuid: saRoleUuid,
        role_code: 'SUPER_ADMIN',
        permission_uuid: permUuid,
      },
    });
  }

  // ADMIN permissions
  const adminPermCodes = [
    'users.read', 'users.create', 'users.update', 'users.view_activity',
    'roles.manage', 'permissions.manage', 'navigation.manage', 'audit_logs.read', 'error_logs.read',
    'settings.manage', 'moderators.manage', 'messaging.manage',
    'messaging.messages', 'messaging.campaigns', 'messaging.contacts', 'messaging.templates',
    'messaging.providers', 'messaging.analytics', 'messaging.webhooks', 'messaging.settings',
  ];
  const adminRoleUuid = roleMap.get('ADMIN')!;
  for (const code of adminPermCodes) {
    const permUuid = createdPermissions.get(code);
    if (permUuid) {
      await prisma.rolePermission.create({
        data: {
          role_uuid: adminRoleUuid,
          role_code: 'ADMIN',
          permission_uuid: permUuid,
        },
      });
    }
  }

  // MODERATOR permissions
  const modPermCodes = ['users.read', 'users.update', 'users.view_activity'];
  const modRoleUuid = roleMap.get('MODERATOR')!;
  for (const code of modPermCodes) {
    const permUuid = createdPermissions.get(code);
    if (permUuid) {
      await prisma.rolePermission.create({
        data: {
          role_uuid: modRoleUuid,
          role_code: 'MODERATOR',
          permission_uuid: permUuid,
        },
      });
    }
  }

  // 3. Seed Users
  const superAdminPassword = await bcrypt.hash('SuperAdmin123!', 10);
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const userPassword = await bcrypt.hash('User123!', 10);

  const superAdmin = await prisma.user.create({
    data: {
      email: 'superadmin@example.com',
      password_hash: superAdminPassword,
      first_name: 'Super',
      last_name: 'Administrator',
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      phone_number: '+1 (555) 000-0001',
      address: 'Headquarters, Silicon Valley, CA',
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password_hash: adminPassword,
      first_name: 'Operations',
      last_name: 'Admin',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      phone_number: '+1 (555) 000-0002',
    },
  });

  const moderator = await prisma.user.create({
    data: {
      email: 'moderator@example.com',
      password_hash: userPassword,
      first_name: 'Community',
      last_name: 'Moderator',
      role: Role.MODERATOR,
      status: UserStatus.ACTIVE,
      phone_number: '+1 (555) 000-0003',
    },
  });

  const standardUser = await prisma.user.create({
    data: {
      email: 'user@example.com',
      password_hash: userPassword,
      first_name: 'John',
      last_name: 'Doe',
      role: Role.USER,
      status: UserStatus.ACTIVE,
      phone_number: '+1 (555) 123-4567',
      address: '742 Evergreen Terrace, Springfield',
    },
  });

  // Additional mock users for data tables
  const demoUsers = [
    { email: 'alex.rivera@example.com', first_name: 'Alex', last_name: 'Rivera', role: Role.USER, status: UserStatus.ACTIVE },
    { email: 'emily.watson@example.com', first_name: 'Emily', last_name: 'Watson', role: Role.MODERATOR, status: UserStatus.ACTIVE },
    { email: 'marcus.chen@example.com', first_name: 'Marcus', last_name: 'Chen', role: Role.USER, status: UserStatus.INACTIVE },
    { email: 'sophia.taylor@example.com', first_name: 'Sophia', last_name: 'Taylor', role: Role.ADMIN, status: UserStatus.ACTIVE },
    { email: 'david.kim@example.com', first_name: 'David', last_name: 'Kim', role: Role.USER, status: UserStatus.SUSPENDED },
    { email: 'olivia.brown@example.com', first_name: 'Olivia', last_name: 'Brown', role: Role.USER, status: UserStatus.ACTIVE },
    { email: 'liam.johnson@example.com', first_name: 'Liam', last_name: 'Johnson', role: Role.USER, status: UserStatus.INACTIVE },
    { email: 'emma.garcia@example.com', first_name: 'Emma', last_name: 'Garcia', role: Role.MODERATOR, status: UserStatus.ACTIVE },
    { email: 'noah.miller@example.com', first_name: 'Noah', last_name: 'Miller', role: Role.USER, status: UserStatus.ACTIVE },
    { email: 'ava.davis@example.com', first_name: 'Ava', last_name: 'Davis', role: Role.USER, status: UserStatus.ACTIVE },
    { email: 'lucas.martinez@example.com', first_name: 'Lucas', last_name: 'Martinez', role: Role.USER, status: UserStatus.SUSPENDED },
    { email: 'isabella.hernandez@example.com', first_name: 'Isabella', last_name: 'Hernandez', role: Role.USER, status: UserStatus.ACTIVE },
  ];

  for (const du of demoUsers) {
    await prisma.user.create({
      data: {
        email: du.email,
        password_hash: userPassword,
        first_name: du.first_name,
        last_name: du.last_name,
        role: du.role,
        status: du.status,
      },
    });
  }

  // 4. Seed Dynamic Sidebar Navigation (All 11 Required Modules from Section 9.4)
  const menuDefs = [
    { label: 'Dashboard', icon: 'LayoutDashboard', route: '/admin/dashboard', display_order: 1, allowed_roles: 'SUPER_ADMIN,ADMIN,MODERATOR' },
    { label: 'Role & Permissions', icon: 'ShieldCheck', route: '/admin/roles', display_order: 2, required_permission: 'roles.manage', allowed_roles: 'SUPER_ADMIN,ADMIN' },
    { label: 'User Management', icon: 'Users', route: '/admin/users', display_order: 3, required_permission: 'users.read', allowed_roles: 'SUPER_ADMIN,ADMIN,MODERATOR' },
    { label: 'Moderator Management', icon: 'UserCheck', route: '/admin/moderators', display_order: 4, required_permission: 'moderators.manage', allowed_roles: 'SUPER_ADMIN,ADMIN' },
    { label: 'Navigation & Sidebar', icon: 'Menu', route: '/admin/navigation', display_order: 5, required_permission: 'navigation.manage', allowed_roles: 'SUPER_ADMIN' },
    { label: 'Audit Logs', icon: 'ScrollText', route: '/admin/audit-logs', display_order: 6, required_permission: 'audit_logs.read', allowed_roles: 'SUPER_ADMIN,ADMIN' },
    { label: 'User Activity Logs', icon: 'History', route: '/admin/activity-logs', display_order: 7, required_permission: 'users.view_activity', allowed_roles: 'SUPER_ADMIN,ADMIN,MODERATOR' },
    { label: 'Application Error Logs', icon: 'AlertOctagon', route: '/admin/error-logs', display_order: 8, required_permission: 'error_logs.read', allowed_roles: 'SUPER_ADMIN,ADMIN' },
    { label: 'Default Settings', icon: 'Settings', route: '/admin/settings', display_order: 9, required_permission: 'settings.manage', allowed_roles: 'SUPER_ADMIN,ADMIN' },
    { label: 'Profile Management', icon: 'User', route: '/admin/profile', display_order: 10, allowed_roles: 'SUPER_ADMIN,ADMIN,MODERATOR' },
    { label: 'System Health & Monitoring', icon: 'Activity', route: '/admin/health', display_order: 11, allowed_roles: 'SUPER_ADMIN,ADMIN' },
    { label: 'Codebase Knowledge Graph', icon: 'Network', route: '/admin/knowledge-graph', display_order: 12, allowed_roles: 'SUPER_ADMIN,ADMIN' },
    { label: 'Messaging Platform', icon: 'Mail', route: '/admin/messaging', display_order: 13, required_permission: 'messaging.manage', allowed_roles: 'SUPER_ADMIN,ADMIN' },
  ];

  const parentMenuMap = new Map<string, string>();
  for (const m of menuDefs) {
    const created = await prisma.menuItem.create({
      data: {
        label: m.label,
        icon: m.icon,
        route: m.route,
        display_order: m.display_order,
        is_active: true,
        required_permission: m.required_permission || null,
        allowed_roles: m.allowed_roles,
      },
    });
    parentMenuMap.set(m.label, created.menu_uuid);
  }

  // Nested child menu items to demonstrate parent-child dynamic navigation hierarchy!
  const messagingUuid = parentMenuMap.get('Messaging Platform');
  if (messagingUuid) {
    const messagingChildren = [
      { label: 'Overview', icon: 'LayoutDashboard', route: '/admin/messaging', display_order: 1, required_permission: 'messaging.manage' },
      { label: 'Messages', icon: 'Send', route: '/admin/messaging/messages', display_order: 2, required_permission: 'messaging.messages' },
      { label: 'Campaigns', icon: 'Radio', route: '/admin/messaging/campaigns', display_order: 3, required_permission: 'messaging.campaigns' },
      { label: 'Contacts', icon: 'Users', route: '/admin/messaging/contacts', display_order: 4, required_permission: 'messaging.contacts' },
      { label: 'Contact Groups', icon: 'Layers', route: '/admin/messaging/contact-groups', display_order: 5, required_permission: 'messaging.contacts' },
      { label: 'Templates', icon: 'FileText', route: '/admin/messaging/templates', display_order: 6, required_permission: 'messaging.templates' },
      { label: 'Providers', icon: 'Server', route: '/admin/messaging/providers', display_order: 7, required_permission: 'messaging.providers' },
      { label: 'Analytics', icon: 'TrendingUp', route: '/admin/messaging/analytics', display_order: 8, required_permission: 'messaging.analytics' },
      { label: 'Reports', icon: 'BarChart2', route: '/admin/messaging/reports', display_order: 9, required_permission: 'messaging.analytics' },
      { label: 'Usage and Quotas', icon: 'PieChart', route: '/admin/messaging/usage', display_order: 10, required_permission: 'messaging.manage' },
      { label: 'Compliance', icon: 'ShieldCheck', route: '/admin/messaging/compliance', display_order: 11, required_permission: 'messaging.manage' },
      { label: 'Webhook Monitoring', icon: 'Webhook', route: '/admin/messaging/webhooks', display_order: 12, required_permission: 'messaging.webhooks' },
      { label: 'Settings', icon: 'Settings', route: '/admin/messaging/settings', display_order: 13, required_permission: 'messaging.settings' },
    ];

    for (const child of messagingChildren) {
      await prisma.menuItem.create({
        data: {
          parent_uuid: messagingUuid,
          label: child.label,
          icon: child.icon,
          route: child.route,
          display_order: child.display_order,
          is_active: true,
          required_permission: child.required_permission,
          allowed_roles: 'SUPER_ADMIN,ADMIN,MODERATOR,USER',
        },
      });
    }
  }

  const userMgmtUuid = parentMenuMap.get('User Management');
  if (userMgmtUuid) {
    await prisma.menuItem.create({
      data: {
        parent_uuid: userMgmtUuid,
        label: 'Active Users',
        icon: 'UserCheck',
        route: '/admin/users?status=ACTIVE',
        display_order: 1,
        is_active: true,
        required_permission: 'users.read',
        allowed_roles: 'SUPER_ADMIN,ADMIN,MODERATOR',
      },
    });
    await prisma.menuItem.create({
      data: {
        parent_uuid: userMgmtUuid,
        label: 'Suspended Users',
        icon: 'UserX',
        route: '/admin/users?status=SUSPENDED',
        display_order: 2,
        is_active: true,
        required_permission: 'users.read',
        allowed_roles: 'SUPER_ADMIN,ADMIN,MODERATOR',
      },
    });
  }

  // 5. Seed Default Application Settings (Section 9.11)
  const settingsList = [
    { key: 'app.name', value: 'Monorepo Enterprise Platform', type: 'STRING', category: 'GENERAL', is_public: true, description: 'Application display name' },
    { key: 'app.branding.logo_url', value: '/logo.svg', type: 'STRING', category: 'GENERAL', is_public: true, description: 'Brand logo path' },
    { key: 'auth.default_role', value: 'USER', type: 'STRING', category: 'AUTHENTICATION', is_public: false, description: 'Default role assigned on registration' },
    { key: 'auth.registration_enabled', value: 'true', type: 'BOOLEAN', category: 'AUTHENTICATION', is_public: true, description: 'Whether public registration is enabled' },
    { key: 'auth.session_timeout_minutes', value: '60', type: 'NUMBER', category: 'SECURITY', is_public: false, description: 'Idle session timeout in minutes' },
    { key: 'ui.pagination_default', value: '10', type: 'NUMBER', category: 'UI', is_public: true, description: 'Default items per page for data tables' },
    { key: 'ui.theme.default', value: 'light', type: 'STRING', category: 'UI', is_public: true, description: 'System-wide default theme (light, dark, system)' },
    { key: 'app.timezone', value: 'UTC', type: 'STRING', category: 'GENERAL', is_public: true, description: 'System timezone' },
    { key: 'app.date_format', value: 'YYYY-MM-DD HH:mm:ss', type: 'STRING', category: 'UI', is_public: true, description: 'Display format for timestamps' },
    { key: 'notifications.email_alerts_enabled', value: 'true', type: 'BOOLEAN', category: 'NOTIFICATIONS', is_public: false, description: 'Enable system security alerts' },
  ];

  for (const s of settingsList) {
    await prisma.setting.create({
      data: {
        key: s.key,
        value: s.value,
        type: s.type,
        category: s.category,
        is_public: s.is_public,
        description: s.description,
        updated_by_uuid: superAdmin.user_uuid,
      },
    });
  }

  // 6. Seed Sample Structured Audit Logs (Section 9.12)
  const initialCorrelationId = crypto.randomUUID();
  await prisma.auditLog.create({
    data: {
      actor_uuid: superAdmin.user_uuid,
      actor_email: superAdmin.email,
      action: 'SYSTEM_INITIALIZED',
      resource_type: 'System',
      correlation_id: initialCorrelationId,
      outcome: 'SUCCESS',
      before_state: null,
      after_state: { version: '1.0.0', initialized_by: superAdmin.email },
      ip_address: '127.0.0.1',
      user_agent: 'SystemSeeder/1.0',
    },
  });

  // 7. Seed Sample User Activity Logs (Section 9.6)
  await prisma.userActivityLog.create({
    data: {
      user_uuid: superAdmin.user_uuid,
      actor_uuid: superAdmin.user_uuid,
      action: 'LOGIN',
      correlation_id: initialCorrelationId,
      metadata: { login_method: 'PASSWORD', mfa: false },
      ip_address: '127.0.0.1',
      user_agent: 'Chrome/120.0 Linux',
    },
  });

  // 8. Seed Messaging Providers (Phase 1)
  const providers = [
    {
      name: 'Custom SMTP Server',
      slug: 'smtp',
      type: 'EMAIL' as const,
      description: 'Send emails using standard SMTP protocols with TLS/SSL encryption.',
      logo: '/providers/smtp.svg',
      status: 'ACTIVE' as const,
      is_default: true,
      documentation_url: 'https://en.wikipedia.org/wiki/Simple_Mail_Transfer_Protocol',
      configuration_schema: {
        type: 'object',
        required: ['host', 'port', 'secure', 'auth_user', 'auth_password'],
        properties: {
          host: { type: 'string', title: 'SMTP Host' },
          port: { type: 'number', title: 'Port (e.g. 587, 465, 25)' },
          secure: { type: 'boolean', title: 'Use SSL/TLS (true for 465, false for 587/STARTTLS)' },
          auth_user: { type: 'string', title: 'SMTP Username' },
          auth_password: { type: 'string', title: 'SMTP Password', format: 'password' },
        },
      },
      form_fields: [
        { name: 'configuration_name', label: 'Configuration Name', type: 'text', placeholder: 'My Company SMTP', required: true },
        { name: 'sender_name', label: 'Default From Name', type: 'text', placeholder: 'Acme Support', required: true },
        { name: 'sender_email', label: 'Default From Email', type: 'email', placeholder: 'support@acme.com', required: true },
        { name: 'reply_to', label: 'Reply-To Email', type: 'email', placeholder: 'help@acme.com', required: false },
        { name: 'host', label: 'SMTP Host', type: 'text', placeholder: 'smtp.mailtrap.io or smtp.gmail.com', required: true },
        { name: 'port', label: 'SMTP Port', type: 'number', placeholder: '587', required: true },
        { name: 'secure', label: 'Use SSL/TLS Directly (Port 465)', type: 'boolean', defaultValue: false, required: false },
        { name: 'auth_user', label: 'SMTP Username', type: 'text', placeholder: 'username / api_user', required: true },
        { name: 'auth_password', label: 'SMTP Password', type: 'password', placeholder: '••••••••', required: true },
      ],
    },
    {
      name: 'SendGrid Email API',
      slug: 'sendgrid',
      type: 'EMAIL' as const,
      description: 'Cloud email delivery service using the official SendGrid REST Mail API.',
      logo: '/providers/sendgrid.svg',
      status: 'ACTIVE' as const,
      is_default: true,
      documentation_url: 'https://docs.sendgrid.com/for-developers/sending-email',
      configuration_schema: {
        type: 'object',
        required: ['api_key'],
        properties: {
          api_key: { type: 'string', title: 'SendGrid API Key', format: 'password' },
        },
      },
      form_fields: [
        { name: 'configuration_name', label: 'Configuration Name', type: 'text', placeholder: 'Production SendGrid Account', required: true },
        { name: 'sender_name', label: 'Verified Sender Name', type: 'text', placeholder: 'Acme Notifications', required: true },
        { name: 'sender_email', label: 'Verified Sender Email', type: 'email', placeholder: 'notifications@acme.com', required: true },
        { name: 'reply_to', label: 'Reply-To Email', type: 'email', placeholder: 'support@acme.com', required: false },
        { name: 'api_key', label: 'SendGrid API Key (SG...)', type: 'password', placeholder: 'SG.xxxxxxxxxxxxxxxxxxxxxxxx', required: true },
      ],
    },
    {
      name: 'Amazon SES',
      slug: 'amazon-ses',
      type: 'EMAIL' as const,
      description: 'High-throughput, cost-effective Amazon Simple Email Service (SES) via SMTP interface.',
      logo: '/providers/amazon-ses.svg',
      status: 'ACTIVE' as const,
      is_default: true,
      documentation_url: 'https://docs.aws.amazon.com/ses/latest/dg/send-email-smtp.html',
      configuration_schema: {
        type: 'object',
        required: ['host', 'port', 'auth_user', 'auth_password'],
        properties: {
          host: { type: 'string', title: 'SES SMTP Endpoint', default: 'email-smtp.us-east-1.amazonaws.com' },
          port: { type: 'number', title: 'Port (587 or 465)', default: 587 },
          auth_user: { type: 'string', title: 'SMTP User Name (IAM Access Key)' },
          auth_password: { type: 'string', title: 'SMTP Password (Secret Key)', format: 'password' },
        },
      },
      form_fields: [
        { name: 'host', label: 'SES SMTP Host', type: 'text', placeholder: 'email-smtp.us-east-1.amazonaws.com', default_value: 'email-smtp.us-east-1.amazonaws.com', required: true, description: 'AWS SES SMTP endpoint for your region' },
        { name: 'port', label: 'Port', type: 'number', placeholder: '587', default_value: 587, required: true },
        { name: 'auth_user', label: 'SES SMTP User Name', type: 'text', placeholder: 'AKIA_EXAMPLE_USERNAME', required: true, description: 'Generated SES SMTP username' },
        { name: 'auth_password', label: 'SES SMTP Password', type: 'password', placeholder: '••••••••', required: true, description: 'Generated SES SMTP password' },
      ],
    },
    {
      name: 'Mailgun',
      slug: 'mailgun',
      type: 'EMAIL' as const,
      description: 'Transactional email API and SMTP relay for developers by Sinch Mailgun.',
      logo: '/providers/mailgun.svg',
      status: 'ACTIVE' as const,
      is_default: true,
      documentation_url: 'https://documentation.mailgun.com/docs/mailgun/user-manual/sending-messages/#sending-via-smtp',
      configuration_schema: {
        type: 'object',
        required: ['host', 'port', 'auth_user', 'auth_password'],
        properties: {
          host: { type: 'string', title: 'Mailgun Host', default: 'smtp.mailgun.org' },
          port: { type: 'number', title: 'Port', default: 587 },
          auth_user: { type: 'string', title: 'SMTP Login (postmaster@yourdomain.com)' },
          auth_password: { type: 'string', title: 'SMTP Password', format: 'password' },
        },
      },
      form_fields: [
        { name: 'host', label: 'Mailgun SMTP Host', type: 'text', placeholder: 'smtp.mailgun.org', default_value: 'smtp.mailgun.org', required: true },
        { name: 'port', label: 'Port', type: 'number', placeholder: '587', default_value: 587, required: true },
        { name: 'auth_user', label: 'SMTP Username', type: 'text', placeholder: 'postmaster@yourdomain.com', required: true },
        { name: 'auth_password', label: 'SMTP Password', type: 'password', placeholder: '••••••••', required: true },
      ],
    },
    {
      name: 'Mailchimp Transactional',
      slug: 'mailchimp-transactional',
      type: 'EMAIL' as const,
      description: 'Fast, customized transactional emails via Mandrill SMTP relay.',
      logo: '/providers/mailchimp.svg',
      status: 'ACTIVE' as const,
      is_default: true,
      documentation_url: 'https://mailchimp.com/developer/transactional/docs/smtp-integration/',
      configuration_schema: {
        type: 'object',
        required: ['host', 'port', 'auth_user', 'auth_password'],
        properties: {
          host: { type: 'string', title: 'Mandrill Host', default: 'smtp.mandrillapp.com' },
          port: { type: 'number', title: 'Port', default: 587 },
          auth_user: { type: 'string', title: 'Mandrill Username' },
          auth_password: { type: 'string', title: 'Mandrill API Key', format: 'password' },
        },
      },
      form_fields: [
        { name: 'host', label: 'Mandrill SMTP Host', type: 'text', placeholder: 'smtp.mandrillapp.com', default_value: 'smtp.mandrillapp.com', required: true },
        { name: 'port', label: 'Port', type: 'number', placeholder: '587', default_value: 587, required: true },
        { name: 'auth_user', label: 'Account Email / Username', type: 'text', placeholder: 'admin@acme.com', required: true },
        { name: 'auth_password', label: 'Mandrill API Key', type: 'password', placeholder: '••••••••', required: true, description: 'Any active Mandrill API key can be used as the SMTP password' },
      ],
    },
    {
      name: 'Brevo (Sendinblue)',
      slug: 'brevo',
      type: 'EMAIL' as const,
      description: 'All-in-one marketing and transactional email delivery via Brevo SMTP relay.',
      logo: '/providers/brevo.svg',
      status: 'ACTIVE' as const,
      is_default: true,
      documentation_url: 'https://help.brevo.com/hc/en-us/articles/209467405-What-is-Brevo-SMTP',
      configuration_schema: {
        type: 'object',
        required: ['host', 'port', 'auth_user', 'auth_password'],
        properties: {
          host: { type: 'string', title: 'Brevo Host', default: 'smtp-relay.brevo.com' },
          port: { type: 'number', title: 'Port', default: 587 },
          auth_user: { type: 'string', title: 'Brevo Login' },
          auth_password: { type: 'string', title: 'SMTP Key', format: 'password' },
        },
      },
      form_fields: [
        { name: 'host', label: 'Brevo SMTP Host', type: 'text', placeholder: 'smtp-relay.brevo.com', default_value: 'smtp-relay.brevo.com', required: true },
        { name: 'port', label: 'Port', type: 'number', placeholder: '587', default_value: 587, required: true },
        { name: 'auth_user', label: 'Brevo Login Email', type: 'text', placeholder: 'login@domain.com', required: true },
        { name: 'auth_password', label: 'SMTP Master Key', type: 'password', placeholder: '••••••••', required: true },
      ],
    },
    {
      name: 'Postmark',
      slug: 'postmark',
      type: 'EMAIL' as const,
      description: 'Lightning fast email delivery service specialized for transactional messages.',
      logo: '/providers/postmark.svg',
      status: 'ACTIVE' as const,
      is_default: true,
      documentation_url: 'https://postmarkapp.com/developer/user-guide/send-email-with-smtp',
      configuration_schema: {
        type: 'object',
        required: ['host', 'port', 'auth_user', 'auth_password'],
        properties: {
          host: { type: 'string', title: 'Postmark Host', default: 'smtp.postmarkapp.com' },
          port: { type: 'number', title: 'Port', default: 587 },
          auth_user: { type: 'string', title: 'Server API Token' },
          auth_password: { type: 'string', title: 'Server API Token', format: 'password' },
        },
      },
      form_fields: [
        { name: 'host', label: 'Postmark SMTP Host', type: 'text', placeholder: 'smtp.postmarkapp.com', default_value: 'smtp.postmarkapp.com', required: true },
        { name: 'port', label: 'Port', type: 'number', placeholder: '587', default_value: 587, required: true },
        { name: 'auth_user', label: 'Server API Token', type: 'text', placeholder: '25b3...-....-....-....-..........', required: true, description: 'Postmark Server API Token is used as both username and password' },
        { name: 'auth_password', label: 'Server API Token', type: 'password', placeholder: '••••••••', required: true },
      ],
    },
    {
      name: 'Resend',
      slug: 'resend',
      type: 'EMAIL' as const,
      description: 'Modern email platform with first-class React Email and SMTP support.',
      logo: '/providers/resend.svg',
      status: 'ACTIVE' as const,
      is_default: true,
      documentation_url: 'https://resend.com/docs/dashboard/emails/smtp',
      configuration_schema: {
        type: 'object',
        required: ['host', 'port', 'auth_user', 'auth_password'],
        properties: {
          host: { type: 'string', title: 'Resend Host', default: 'smtp.resend.com' },
          port: { type: 'number', title: 'Port', default: 465 },
          auth_user: { type: 'string', title: 'Username (resend)', default: 'resend' },
          auth_password: { type: 'string', title: 'Resend API Key (re_...)', format: 'password' },
        },
      },
      form_fields: [
        { name: 'host', label: 'Resend SMTP Host', type: 'text', placeholder: 'smtp.resend.com', default_value: 'smtp.resend.com', required: true },
        { name: 'port', label: 'Port (SSL: 465, TLS: 587)', type: 'number', placeholder: '465', default_value: 465, required: true },
        { name: 'auth_user', label: 'Username', type: 'text', placeholder: 'resend', default_value: 'resend', required: true, description: 'Always "resend" for Resend SMTP' },
        { name: 'auth_password', label: 'Resend API Key', type: 'password', placeholder: 're_1234567890abcdef', required: true, description: 'Your Resend API Key' },
      ],
    },
    {
      name: 'Meta WhatsApp Cloud API',
      slug: 'whatsapp-cloud',
      type: 'WHATSAPP' as const,
      description: 'Official Meta WhatsApp Business Platform Cloud API for direct interactive messaging, templates, and webhooks.',
      logo: '/providers/whatsapp.svg',
      status: 'ACTIVE' as const,
      is_default: true,
      documentation_url: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
      configuration_schema: {
        type: 'object',
        required: ['phone_number_id', 'waba_id', 'access_token', 'app_secret', 'webhook_verify_token'],
        properties: {
          phone_number_id: { type: 'string', title: 'Phone Number ID' },
          waba_id: { type: 'string', title: 'WhatsApp Business Account (WABA) ID' },
          access_token: { type: 'string', title: 'Permanent System User Access Token', format: 'password' },
          app_id: { type: 'string', title: 'Meta App ID' },
          app_secret: { type: 'string', title: 'Meta App Secret', format: 'password' },
          webhook_verify_token: { type: 'string', title: 'Webhook Verification Token' },
          api_version: { type: 'string', title: 'Graph API Version', default: 'v21.0' },
        },
      },
      form_fields: [
        { name: 'configuration_name', label: 'Configuration Name', type: 'text', placeholder: 'Acme Official WhatsApp', required: true, description: 'Internal name for this WhatsApp business number' },
        { name: 'sender_phone', label: 'Display Phone Number', type: 'text', placeholder: '+1 (555) 019-2834', required: true, description: 'WhatsApp Business Number formatted in E.164' },
        { name: 'phone_number_id', label: 'Phone Number ID', type: 'text', placeholder: '109283746501928', required: true, description: 'Found in Meta App Dashboard > WhatsApp > API Setup' },
        { name: 'waba_id', label: 'WhatsApp Business Account (WABA) ID', type: 'text', placeholder: '192837465019283', required: true, description: 'Found in Meta App Dashboard > WhatsApp > API Setup' },
        { name: 'access_token', label: 'System User Permanent Access Token', type: 'password', placeholder: 'EAAG...', required: true, description: 'System User token with whatsapp_business_messaging and whatsapp_business_management' },
        { name: 'app_id', label: 'Meta App ID', type: 'text', placeholder: '123456789012345', required: false, description: 'App ID from Meta Developer App Settings' },
        { name: 'app_secret', label: 'Meta App Secret', type: 'password', placeholder: '••••••••••••••••••••••••••••••••', required: true, description: 'App Secret used to cryptographically verify X-Hub-Signature-256' },
        { name: 'webhook_verify_token', label: 'Webhook Verify Token', type: 'text', placeholder: 'whsec_whatsapp_secret_key', required: true, description: 'Custom verification token to match Meta Webhook configuration' },
        { name: 'api_version', label: 'Graph API Version', type: 'text', placeholder: 'v21.0', default_value: 'v21.0', required: false, description: 'Meta Graph API version (default v21.0)' },
      ],
    },
    {
      name: 'Interakt WhatsApp Business',
      slug: 'whatsapp-interakt',
      type: 'WHATSAPP' as const,
      description: 'Official Meta Tech Partner & BSP platform for WhatsApp customer engagement, campaigns, and notifications.',
      logo: '/providers/interakt.svg',
      status: 'ACTIVE' as const,
      is_default: false,
      documentation_url: 'https://www.interakt.shop/resource-center/api-documentation',
      configuration_schema: {
        type: 'object',
        required: ['api_key', 'webhook_verify_token'],
        properties: {
          api_key: { type: 'string', title: 'Interakt Secret API Key', format: 'password' },
          app_id: { type: 'string', title: 'Interakt Project / App ID' },
          webhook_verify_token: { type: 'string', title: 'Webhook Verification Secret' },
        },
      },
      form_fields: [
        { name: 'configuration_name', label: 'Configuration Name', type: 'text', placeholder: 'Interakt Production Line', required: true, description: 'Internal name for this Interakt profile' },
        { name: 'sender_phone', label: 'Registered WhatsApp Phone', type: 'text', placeholder: '+1 (555) 019-2834', required: true, description: 'WhatsApp Business Number in E.164' },
        { name: 'api_key', label: 'Interakt Secret API Key', type: 'password', placeholder: '••••••••••••••••••••••••••••••••', required: true, description: 'Found in Interakt Dashboard > Developer Settings > Secret Key' },
        { name: 'app_id', label: 'Interakt Project / App ID', type: 'text', placeholder: 'app_interakt_123', required: false, description: 'Optional project identifier' },
        { name: 'webhook_verify_token', label: 'Webhook Verification Secret', type: 'text', placeholder: 'whsec_interakt_token', required: true, description: 'Shared secret to verify incoming Interakt webhook events' },
      ],
    },
    {
      name: 'WATI WhatsApp Platform',
      slug: 'whatsapp-wati',
      type: 'WHATSAPP' as const,
      description: 'Enterprise Meta Business Solution Provider (BSP) for WhatsApp team inbox, notifications, and automations.',
      logo: '/providers/wati.svg',
      status: 'ACTIVE' as const,
      is_default: false,
      documentation_url: 'https://docs.wati.io/reference/introduction',
      configuration_schema: {
        type: 'object',
        required: ['api_endpoint', 'access_token', 'webhook_verify_token'],
        properties: {
          api_endpoint: { type: 'string', title: 'WATI Instance API Endpoint URL' },
          access_token: { type: 'string', title: 'WATI Bearer Access Token', format: 'password' },
          webhook_verify_token: { type: 'string', title: 'Webhook Verification Secret' },
        },
      },
      form_fields: [
        { name: 'configuration_name', label: 'Configuration Name', type: 'text', placeholder: 'WATI Support Inbox', required: true, description: 'Internal name for this WATI connection' },
        { name: 'sender_phone', label: 'WATI Registered WhatsApp Phone', type: 'text', placeholder: '+1 (555) 019-2834', required: true, description: 'Registered WhatsApp phone number in E.164' },
        { name: 'api_endpoint', label: 'WATI Instance Endpoint URL', type: 'text', placeholder: 'https://live-server-xxxx.wati.io', required: true, description: 'Found in WATI Dashboard > API Docs' },
        { name: 'access_token', label: 'WATI API Bearer Token', type: 'password', placeholder: 'Bearer eyJhbGciOi...', required: true, description: 'Access token generated from WATI API Docs' },
        { name: 'webhook_verify_token', label: 'Webhook Verification Secret', type: 'text', placeholder: 'whsec_wati_token', required: true, description: 'Shared secret to authenticate incoming WATI webhooks' },
      ],
    },
    {
      name: 'Twilio WhatsApp API',
      slug: 'whatsapp-twilio',
      type: 'WHATSAPP' as const,
      description: 'Twilio Programmable Messaging API for global WhatsApp notifications and conversations.',
      logo: '/providers/twilio.svg',
      status: 'ACTIVE' as const,
      is_default: false,
      documentation_url: 'https://www.twilio.com/docs/whatsapp/api',
      configuration_schema: {
        type: 'object',
        required: ['account_sid', 'auth_token', 'webhook_verify_token'],
        properties: {
          account_sid: { type: 'string', title: 'Twilio Account SID' },
          auth_token: { type: 'string', title: 'Twilio Auth Token', format: 'password' },
          webhook_verify_token: { type: 'string', title: 'Webhook Verification Secret' },
        },
      },
      form_fields: [
        { name: 'configuration_name', label: 'Configuration Name', type: 'text', placeholder: 'Twilio WhatsApp Notifications', required: true, description: 'Internal name for this Twilio WhatsApp channel' },
        { name: 'sender_phone', label: 'Twilio WhatsApp Sender Number', type: 'text', placeholder: '+14155238886', required: true, description: 'Twilio WhatsApp enabled number or Sandbox number' },
        { name: 'account_sid', label: 'Twilio Account SID', type: 'text', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', required: true, description: 'Found on Twilio Console Dashboard' },
        { name: 'auth_token', label: 'Twilio Auth Token', type: 'password', placeholder: '••••••••••••••••••••••••••••••••', required: true, description: 'Primary Auth Token from Twilio Console' },
        { name: 'webhook_verify_token', label: 'Webhook Verification Secret', type: 'text', placeholder: 'whsec_twilio_token', required: true, description: 'Webhook token to verify Twilio Status Callbacks' },
      ],
    },
    {
      name: 'Infobip WhatsApp Business',
      slug: 'whatsapp-infobip',
      type: 'WHATSAPP' as const,
      description: 'Global tier-1 WhatsApp Business Solution Provider (BSP) for enterprise interactive messaging and omni-channel campaigns.',
      logo: '/providers/infobip.svg',
      status: 'ACTIVE' as const,
      is_default: false,
      documentation_url: 'https://www.infobip.com/docs/whatsapp',
      configuration_schema: {
        type: 'object',
        required: ['api_key', 'base_url', 'webhook_verify_token'],
        properties: {
          api_key: { type: 'string', title: 'Infobip API Key', format: 'password' },
          base_url: { type: 'string', title: 'Infobip Custom Base URL' },
          webhook_verify_token: { type: 'string', title: 'Webhook Verification Secret' },
        },
      },
      form_fields: [
        { name: 'configuration_name', label: 'Configuration Name', type: 'text', placeholder: 'Infobip Enterprise WhatsApp', required: true, description: 'Internal name for this Infobip channel' },
        { name: 'sender_phone', label: 'Infobip WhatsApp Number', type: 'text', placeholder: '+1 (555) 019-2834', required: true, description: 'Infobip registered WhatsApp phone number in E.164' },
        { name: 'base_url', label: 'Infobip Base URL', type: 'text', placeholder: 'https://xxxx.api.infobip.com', required: true, description: 'Custom API base URL assigned to your Infobip account' },
        { name: 'api_key', label: 'Infobip API Key', type: 'password', placeholder: '••••••••••••••••••••••••••••••••', required: true, description: 'API Key from Infobip Developer Tools' },
        { name: 'webhook_verify_token', label: 'Webhook Verification Secret', type: 'text', placeholder: 'whsec_infobip_secret', required: true, description: 'Secret token to verify incoming Infobip delivery reports' },
      ],
    },
    {
      name: 'Gupshup WhatsApp Platform',
      slug: 'whatsapp-gupshup',
      type: 'WHATSAPP' as const,
      description: 'Leading conversational messaging cloud platform for WhatsApp Business API chatbots, campaigns, and customer support.',
      logo: '/providers/gupshup.svg',
      status: 'ACTIVE' as const,
      is_default: false,
      documentation_url: 'https://docs.gupshup.io/reference/whatsapp-api',
      configuration_schema: {
        type: 'object',
        required: ['api_key', 'app_name', 'webhook_verify_token'],
        properties: {
          api_key: { type: 'string', title: 'Gupshup API Key', format: 'password' },
          app_name: { type: 'string', title: 'Gupshup App Name' },
          webhook_verify_token: { type: 'string', title: 'Webhook Verification Secret' },
        },
      },
      form_fields: [
        { name: 'configuration_name', label: 'Configuration Name', type: 'text', placeholder: 'Gupshup Support Bot', required: true, description: 'Internal name for this Gupshup connection' },
        { name: 'sender_phone', label: 'Source WhatsApp Number', type: 'text', placeholder: '+1 (555) 019-2834', required: true, description: 'Registered Gupshup WhatsApp phone number in E.164' },
        { name: 'app_name', label: 'Gupshup WhatsApp App Name', type: 'text', placeholder: 'my_gupshup_wa_app', required: true, description: 'App Name configured in Gupshup Dashboard' },
        { name: 'api_key', label: 'Gupshup API Key', type: 'password', placeholder: '••••••••••••••••••••••••••••••••', required: true, description: 'API Key found in your Gupshup profile' },
        { name: 'webhook_verify_token', label: 'Webhook Verification Secret', type: 'text', placeholder: 'whsec_gupshup_secret', required: true, description: 'Shared secret to verify incoming Gupshup callbacks' },
      ],
    },
    {
      name: 'Vonage (Nexmo) WhatsApp API',
      slug: 'whatsapp-vonage',
      type: 'WHATSAPP' as const,
      description: 'Vonage Messages API for enterprise WhatsApp business messaging, verification codes, and rich media.',
      logo: '/providers/vonage.svg',
      status: 'ACTIVE' as const,
      is_default: false,
      documentation_url: 'https://developer.vonage.com/en/messages/concepts/whatsapp',
      configuration_schema: {
        type: 'object',
        required: ['api_key', 'api_secret', 'webhook_verify_token'],
        properties: {
          api_key: { type: 'string', title: 'Vonage API Key' },
          api_secret: { type: 'string', title: 'Vonage API Secret', format: 'password' },
          webhook_verify_token: { type: 'string', title: 'Webhook Verification Secret' },
        },
      },
      form_fields: [
        { name: 'configuration_name', label: 'Configuration Name', type: 'text', placeholder: 'Vonage Production Alerts', required: true, description: 'Internal name for this Vonage channel' },
        { name: 'sender_phone', label: 'Vonage WhatsApp Number', type: 'text', placeholder: '+1 (555) 019-2834', required: true, description: 'Vonage virtual number with WhatsApp enabled' },
        { name: 'api_key', label: 'Vonage API Key', type: 'text', placeholder: 'a1b2c3d4', required: true, description: 'Vonage dashboard API Key' },
        { name: 'api_secret', label: 'Vonage API Secret', type: 'password', placeholder: '••••••••••••••••', required: true, description: 'Vonage dashboard API Secret' },
        { name: 'webhook_verify_token', label: 'Webhook Verification Secret', type: 'text', placeholder: 'whsec_vonage_token', required: true, description: 'Secret token to authenticate Vonage inbound webhooks' },
      ],
    },
    {
      name: 'AISensy WhatsApp Engagement',
      slug: 'whatsapp-aisensy',
      type: 'WHATSAPP' as const,
      description: 'AI-powered WhatsApp marketing platform built on Meta Cloud API for automated notifications, broadcasts, and chatbots.',
      logo: '/providers/aisensy.svg',
      status: 'ACTIVE' as const,
      is_default: false,
      documentation_url: 'https://docs.aisensy.com',
      configuration_schema: {
        type: 'object',
        required: ['api_key', 'webhook_verify_token'],
        properties: {
          api_key: { type: 'string', title: 'AISensy API Key', format: 'password' },
          campaign_name: { type: 'string', title: 'Default Campaign Name' },
          webhook_verify_token: { type: 'string', title: 'Webhook Verification Secret' },
        },
      },
      form_fields: [
        { name: 'configuration_name', label: 'Configuration Name', type: 'text', placeholder: 'AISensy Marketing Channel', required: true, description: 'Internal name for this AISensy connection' },
        { name: 'sender_phone', label: 'AISensy WhatsApp Phone', type: 'text', placeholder: '+1 (555) 019-2834', required: true, description: 'Registered WhatsApp phone in E.164' },
        { name: 'api_key', label: 'AISensy API Key', type: 'password', placeholder: '••••••••••••••••••••••••••••••••', required: true, description: 'Found in AISensy Dashboard > Manage > API Key' },
        { name: 'campaign_name', label: 'Default Campaign Name (Optional)', type: 'text', placeholder: 'e.g., General Support or Order Updates', required: false, description: 'Optional default campaign tag' },
        { name: 'webhook_verify_token', label: 'Webhook Verification Secret', type: 'text', placeholder: 'whsec_aisensy_token', required: true, description: 'Shared secret to verify incoming webhooks from AISensy' },
      ],
    },
    {
      name: 'Twilio Programmable SMS',
      slug: 'twilio-sms',
      type: 'SMS' as const,
      description: 'Global carrier connectivity for automated SMS notifications, two-factor auth (2FA), and two-way conversations.',
      logo: '/providers/twilio.svg',
      status: 'ACTIVE' as const,
      is_default: true,
      documentation_url: 'https://www.twilio.com/docs/messaging/services',
      configuration_schema: {
        type: 'object',
        required: ['account_sid', 'auth_token'],
        properties: {
          account_sid: { type: 'string', title: 'Twilio Account SID' },
          auth_token: { type: 'string', title: 'Twilio Auth Token', format: 'password' },
          sender_phone: { type: 'string', title: 'Twilio Phone Number' },
          messaging_service_sid: { type: 'string', title: 'Messaging Service SID (MG...)' },
          api_key_sid: { type: 'string', title: 'API Key SID (SK...)' },
          api_key_secret: { type: 'string', title: 'API Key Secret', format: 'password' },
          webhook_verify_token: { type: 'string', title: 'Webhook Verification Secret' },
        },
      },
      form_fields: [
        { name: 'configuration_name', label: 'Configuration Name', type: 'text', placeholder: 'Twilio Production SMS', required: true, description: 'Internal descriptive name for this SMS configuration' },
        { name: 'sender_phone', label: 'Twilio Phone Number / Sender ID', type: 'text', placeholder: '+1 (555) 019-2834', required: true, description: 'Twilio purchased phone number in E.164 format or alphanumeric sender ID' },
        { name: 'account_sid', label: 'Twilio Account SID (AC...)', type: 'text', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', required: true, description: 'Found in Twilio Console Dashboard' },
        { name: 'auth_token', label: 'Twilio Auth Token', type: 'password', placeholder: '••••••••••••••••••••••••••••••••', required: true, description: 'Primary Auth Token from Twilio Console Dashboard' },
        { name: 'messaging_service_sid', label: 'Messaging Service SID (Optional)', type: 'text', placeholder: 'MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', required: false, description: 'Optional Twilio Messaging Service SID (MG...)' },
        { name: 'api_key_sid', label: 'API Key SID (Optional)', type: 'text', placeholder: 'SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', required: false, description: 'Alternative API Key authentication' },
        { name: 'api_key_secret', label: 'API Key Secret (Optional)', type: 'password', placeholder: '••••••••••••••••••••••••••••••••', required: false, description: 'Secret paired with API Key SID' },
        { name: 'webhook_verify_token', label: 'Webhook Verification Secret', type: 'text', placeholder: 'whsec_twilio_sms_secret', required: false, description: 'Secret token used to authenticate Twilio status callbacks' },
      ],
    },
    {
      name: 'Amazon Web Services (AWS SNS)',
      slug: 'aws-sns-sms',
      type: 'SMS' as const,
      description: 'High-scale transactional & marketing SMS delivery via Amazon SNS & AWS End User Messaging.',
      logo: '/providers/aws.svg',
      status: 'ACTIVE' as const,
      is_default: false,
      documentation_url: 'https://docs.aws.amazon.com/sns/latest/dg/sns-mobile-phone-number-sms-token.html',
      configuration_schema: {
        type: 'object',
        required: ['aws_access_key_id', 'aws_secret_access_key', 'aws_region'],
        properties: {
          aws_access_key_id: { type: 'string', title: 'AWS Access Key ID' },
          aws_secret_access_key: { type: 'string', title: 'AWS Secret Access Key', format: 'password' },
          aws_region: { type: 'string', title: 'AWS Region' },
          sender_phone: { type: 'string', title: 'Origination Phone / Sender ID' },
          sender_id: { type: 'string', title: 'Alphanumeric Sender ID' },
          sms_type: { type: 'string', title: 'Default SMS Type (Transactional/Promotional)' },
        },
      },
      form_fields: [
        { name: 'configuration_name', label: 'Configuration Name', type: 'text', placeholder: 'AWS SNS Production SMS', required: true, description: 'Internal descriptive name for this connection' },
        { name: 'sender_phone', label: 'Origination Phone / 10DLC (Optional)', type: 'text', placeholder: '+1 (555) 019-2834', required: false, description: 'AWS Pinpoint / SNS origination phone number in E.164' },
        { name: 'aws_access_key_id', label: 'AWS Access Key ID', type: 'text', placeholder: 'AKIA_EXAMPLE_KEY_ID', required: true, description: 'IAM Access Key with sns:Publish permissions' },
        { name: 'aws_secret_access_key', label: 'AWS Secret Access Key', type: 'password', placeholder: '••••••••••••••••••••••••••••••••', required: true, description: 'AWS IAM Secret Access Key' },
        { name: 'aws_region', label: 'AWS Region', type: 'select', default_value: 'us-east-1', required: true, description: 'AWS Region where SNS is provisioned', options: [
          { label: 'US East (N. Virginia) - us-east-1', value: 'us-east-1' },
          { label: 'US West (Oregon) - us-west-2', value: 'us-west-2' },
          { label: 'Europe (Ireland) - eu-west-1', value: 'eu-west-1' },
          { label: 'Asia Pacific (Mumbai) - ap-south-1', value: 'ap-south-1' },
          { label: 'Asia Pacific (Singapore) - ap-southeast-1', value: 'ap-southeast-1' },
        ]},
        { name: 'sender_id', label: 'Alphanumeric Sender ID (Optional)', type: 'text', placeholder: 'MYBRAND', required: false, description: 'Custom alphanumeric Sender ID up to 11 characters where supported' },
        { name: 'sms_type', label: 'Default SMS Message Type', type: 'select', default_value: 'Transactional', required: true, description: 'Critical vs marketing delivery prioritization', options: [
          { label: 'Transactional (High priority OTP & alerts)', value: 'Transactional' },
          { label: 'Promotional (Cost-effective marketing)', value: 'Promotional' },
        ]},
      ],
    },
    {
      name: 'MessageBird (Bird)',
      slug: 'messagebird-sms',
      type: 'SMS' as const,
      description: 'Global cloud communications gateway directly connected to 240+ telecom operators worldwide.',
      logo: '/providers/messagebird.svg',
      status: 'ACTIVE' as const,
      is_default: false,
      documentation_url: 'https://developers.messagebird.com/api/sms-messaging',
      configuration_schema: {
        type: 'object',
        required: ['api_key', 'sender_phone'],
        properties: {
          api_key: { type: 'string', title: 'Live API Access Key', format: 'password' },
          sender_phone: { type: 'string', title: 'Originator (Sender ID or Phone)' },
          webhook_signing_key: { type: 'string', title: 'Webhook Signing Key', format: 'password' },
        },
      },
      form_fields: [
        { name: 'configuration_name', label: 'Configuration Name', type: 'text', placeholder: 'MessageBird Global SMS', required: true, description: 'Internal name for this connection' },
        { name: 'sender_phone', label: 'Originator Name or Phone Number', type: 'text', placeholder: 'BirdBrand or +15550192834', required: true, description: 'Originator name (alphanumeric up to 11 chars) or dedicated virtual number in E.164' },
        { name: 'api_key', label: 'MessageBird Live API Key', type: 'password', placeholder: 'live_••••••••••••••••••••', required: true, description: 'API Key from MessageBird / Bird Developer Dashboard' },
        { name: 'webhook_signing_key', label: 'Webhook Signing Key (Optional)', type: 'password', placeholder: '••••••••••••••••••••', required: false, description: 'Used to verify status callback signatures' },
      ],
    },
    {
      name: 'Vonage SMS (Nexmo)',
      slug: 'vonage-sms',
      type: 'SMS' as const,
      description: 'Adaptive routing SMS platform with high deliverability rates across 190+ countries.',
      logo: '/providers/vonage.svg',
      status: 'ACTIVE' as const,
      is_default: false,
      documentation_url: 'https://developer.vonage.com/en/messaging/sms/overview',
      configuration_schema: {
        type: 'object',
        required: ['api_key', 'api_secret', 'sender_phone'],
        properties: {
          api_key: { type: 'string', title: 'Vonage API Key' },
          api_secret: { type: 'string', title: 'Vonage API Secret', format: 'password' },
          sender_phone: { type: 'string', title: 'Sender ID / Virtual Number' },
          signature_secret: { type: 'string', title: 'Signature Secret', format: 'password' },
        },
      },
      form_fields: [
        { name: 'configuration_name', label: 'Configuration Name', type: 'text', placeholder: 'Vonage Production SMS', required: true, description: 'Internal descriptive name for this connection' },
        { name: 'sender_phone', label: 'Sender ID or Vonage Number', type: 'text', placeholder: 'VONAGE or +15550192834', required: true, description: 'Registered alphanumeric Sender ID or Vonage virtual number' },
        { name: 'api_key', label: 'Vonage API Key', type: 'text', placeholder: '9a8b7c6d', required: true, description: 'Vonage API Key found in API Dashboard' },
        { name: 'api_secret', label: 'Vonage API Secret', type: 'password', placeholder: '••••••••••••••••••••', required: true, description: 'Vonage API Secret' },
        { name: 'signature_secret', label: 'Signature Secret (Optional)', type: 'password', placeholder: '••••••••••••••••••••', required: false, description: 'Signature secret for verifying DLR callbacks' },
      ],
    },
    {
      name: 'Plivo SMS',
      slug: 'plivo-sms',
      type: 'SMS' as const,
      description: 'Direct carrier connectivity with local routing and real-time carrier delivery insights.',
      logo: '/providers/plivo.svg',
      status: 'ACTIVE' as const,
      is_default: false,
      documentation_url: 'https://www.plivo.com/docs/sms/',
      configuration_schema: {
        type: 'object',
        required: ['auth_id', 'auth_token', 'sender_phone'],
        properties: {
          auth_id: { type: 'string', title: 'Plivo Auth ID' },
          auth_token: { type: 'string', title: 'Plivo Auth Token', format: 'password' },
          sender_phone: { type: 'string', title: 'Plivo Phone Number' },
        },
      },
      form_fields: [
        { name: 'configuration_name', label: 'Configuration Name', type: 'text', placeholder: 'Plivo Production SMS', required: true, description: 'Internal name for this connection' },
        { name: 'sender_phone', label: 'Plivo Phone Number', type: 'text', placeholder: '+1 (555) 019-2834', required: true, description: 'Plivo-rented source phone number in E.164 format or sender ID' },
        { name: 'auth_id', label: 'Plivo Auth ID (MA...)', type: 'text', placeholder: 'MA_EXAMPLE_AUTH_ID', required: true, description: 'Found in Plivo Console Overview' },
        { name: 'auth_token', label: 'Plivo Auth Token', type: 'password', placeholder: '••••••••••••••••••••••••••••••••', required: true, description: 'Primary Auth Token from Plivo Console' },
      ],
    },
    {
      name: 'Telnyx SMS',
      slug: 'telnyx-sms',
      type: 'SMS' as const,
      description: 'Private, global multi-cloud IP network delivering mission-critical carrier-grade SMS.',
      logo: '/providers/telnyx.svg',
      status: 'ACTIVE' as const,
      is_default: false,
      documentation_url: 'https://developers.telnyx.com/docs/api/v2/messaging',
      configuration_schema: {
        type: 'object',
        required: ['api_key', 'sender_phone'],
        properties: {
          api_key: { type: 'string', title: 'Telnyx API V2 Key', format: 'password' },
          sender_phone: { type: 'string', title: 'Telnyx Phone Number' },
          messaging_profile_id: { type: 'string', title: 'Messaging Profile ID' },
          public_key: { type: 'string', title: 'Public Key' },
        },
      },
      form_fields: [
        { name: 'configuration_name', label: 'Configuration Name', type: 'text', placeholder: 'Telnyx Carrier SMS', required: true, description: 'Internal name for this connection' },
        { name: 'sender_phone', label: 'Telnyx Phone Number', type: 'text', placeholder: '+1 (555) 019-2834', required: true, description: 'Telnyx assigned phone number in E.164 format' },
        { name: 'api_key', label: 'Telnyx API Key (KEY...)', type: 'password', placeholder: 'KEY••••••••••••••••••••••••', required: true, description: 'Telnyx API V2 Key' },
        { name: 'messaging_profile_id', label: 'Messaging Profile ID (Optional)', type: 'text', placeholder: '400f7238-6b80-4889-8d75-xxxxxxxxxxxx', required: false, description: 'Telnyx Messaging Profile UUID' },
        { name: 'public_key', label: 'Webhook Public Key (Optional)', type: 'password', placeholder: '••••••••••••••••', required: false, description: 'Ed25519 public key used for webhook signature verification' },
      ],
    },
    {
      name: 'Infobip SMS',
      slug: 'infobip-sms',
      type: 'SMS' as const,
      description: 'Global omnichannel powerhouse with 800+ direct operator connections across 190+ countries.',
      logo: '/providers/infobip.svg',
      status: 'ACTIVE' as const,
      is_default: false,
      documentation_url: 'https://www.infobip.com/docs/api/channels/sms',
      configuration_schema: {
        type: 'object',
        required: ['api_key', 'base_url', 'sender_phone'],
        properties: {
          api_key: { type: 'string', title: 'Infobip API Key', format: 'password' },
          base_url: { type: 'string', title: 'Infobip Base URL' },
          sender_phone: { type: 'string', title: 'Sender ID / Phone Number' },
        },
      },
      form_fields: [
        { name: 'configuration_name', label: 'Configuration Name', type: 'text', placeholder: 'Infobip Enterprise SMS', required: true, description: 'Internal name for this connection' },
        { name: 'sender_phone', label: 'Sender ID or Phone Number', type: 'text', placeholder: 'InfoBrand or +15550192834', required: true, description: 'Registered alphanumeric Sender ID or assigned phone number' },
        { name: 'api_key', label: 'Infobip API Key', type: 'password', placeholder: '••••••••••••••••••••••••••••••••', required: true, description: 'Infobip API Key (App key)' },
        { name: 'base_url', label: 'Dedicated Base URL', type: 'text', placeholder: 'https://xxxxxx.api.infobip.com', required: true, description: 'Dedicated Infobip API Base URL' },
      ],
    },
  ];

  for (const p of providers) {
    await prisma.provider.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        type: p.type,
        description: p.description,
        logo: p.logo,
        status: p.status,
        is_default: p.is_default,
        documentation_url: p.documentation_url,
        configuration_schema: p.configuration_schema,
        form_fields: p.form_fields,
      },
      create: {
        name: p.name,
        slug: p.slug,
        type: p.type,
        description: p.description,
        logo: p.logo,
        status: p.status,
        is_default: p.is_default,
        documentation_url: p.documentation_url,
        configuration_schema: p.configuration_schema,
        form_fields: p.form_fields,
      },
    });
  }

  // 9. Seed Initial Email Template
  await prisma.emailTemplate.create({
    data: {
      user_uuid: superAdmin.user_uuid,
      name: 'Welcome Onboarding Email',
      description: 'Standard welcome email sent to newly registered platform members',
      subject: 'Welcome to {{app_name}}, {{user_name}}!',
      html_content: `<div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
  <h2 style="color: #4f46e5;">Welcome to {{app_name}}!</h2>
  <p>Hello <strong>{{user_name}}</strong>,</p>
  <p>Thank you for joining our platform. Your account has been provisioned and is ready for use.</p>
  <p style="margin: 25px 0;">
    <a href="{{login_url}}" style="background: #4f46e5; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Sign In to Dashboard</a>
  </p>
  <p style="font-size: 12px; color: #64748b;">If you did not create this account, please ignore this email.</p>
</div>`,
      text_content: 'Welcome to {{app_name}}! Hello {{user_name}}, please log in at {{login_url}}.',
      variables: ['app_name', 'user_name', 'login_url'],
      is_active: true,
    },
  });

  console.log('✅ Comprehensive seeding completed successfully!');
  console.log('   Super Admin: superadmin@example.com / SuperAdmin123!');
  console.log('   Admin:       admin@example.com / Admin123!');
  console.log('   Moderator:   moderator@example.com / User123!');
  console.log('   User:        user@example.com / User123!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
