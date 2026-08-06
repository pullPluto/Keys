# Transactional email

Keys plans to use Cloudflare Email Service for transactional messages such as invitations, email verification, recovery notifications, provisioning decisions, and security alerts. The design uses the Worker email send binding; it does not store an email API token in application code.

Before sending any security email, configure the sending domain, authentication records, suppression/bounce process, approved sender addresses, templates, localization policy, and delivery monitoring. Email is a notification and verification channel, not sufficient evidence to approve privileged access. The Cloudflare service supports outbound transactional email from Workers and describes authentication, magic-link, verification, and alert use cases in its official documentation.
