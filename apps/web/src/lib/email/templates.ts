export function inviteEmailTemplate(input: {
  inviteUrl: string;
  email: string;
}) {
  return {
    subject: "You're invited to Mini-CMS",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h1 style="font-size: 20px; margin-bottom: 12px;">Join Mini-CMS</h1>
        <p>You have been invited to manage content for ${input.email}.</p>
        <p>
          <a href="${input.inviteUrl}" style="display: inline-block; padding: 10px 16px; background: #111; color: #fff; text-decoration: none; border-radius: 8px;">
            Accept invite
          </a>
        </p>
      </div>
    `,
  };
}

export function verificationEmailTemplate(input: {
  verificationUrl: string;
}) {
  return {
    subject: "Confirm your Mini CMS account",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h1 style="font-size: 20px; margin-bottom: 12px;">Confirm your account</h1>
        <p>Finish setting up your Mini CMS account by confirming your email address.</p>
        <p>
          <a href="${input.verificationUrl}" style="display: inline-block; padding: 10px 16px; background: #111; color: #fff; text-decoration: none; border-radius: 8px;">
            Confirm email
          </a>
        </p>
      </div>
    `,
  };
}
