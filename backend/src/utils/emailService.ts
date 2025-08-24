/**
 * Email Service
 * File Path: backend/src/utils/emailService.ts
 * 
 * Handles email sending functionality using nodemailer with SMTP configuration.
 */

import * as nodemailer from 'nodemailer';
import config from '../config/environment';

/**
 * Email Service class for sending emails
 */
export class EmailService {
  private static transporter: nodemailer.Transporter;

  /**
   * Initialize the email transporter
   */
  private static async initializeTransporter(): Promise<void> {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_PORT === 465, // true for 465, false for other ports
        auth: {
          user: config.SMTP_USER,
          pass: config.SMTP_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false, // Allow self-signed certificates for development
        },
      });

      // Verify the connection
      try {
        await this.transporter.verify();
        console.log('✅ Email service connected successfully');
      } catch (error) {
        console.error('❌ Email service connection failed:', error);
        throw new Error('Email service configuration failed');
      }
    }
  }

  /**
   * Send password reset email
   * @param email - Recipient email address
   * @param resetToken - Password reset token
   * @param firstName - User's first name
   * @returns Promise<boolean> - Success status
   */
  static async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    firstName?: string
  ): Promise<boolean> {
    try {
      await this.initializeTransporter();

      const resetUrl = `${config.CORS_ORIGIN}/auth/reset-password?token=${resetToken}`;
      
      const mailOptions = {
        from: {
          name: config.FROM_NAME,
          address: config.FROM_EMAIL,
        },
        to: email,
        subject: 'Penn State Meal Plan - Password Reset Request',
        html: this.generatePasswordResetHTML(firstName, resetUrl, resetToken),
        text: this.generatePasswordResetText(firstName, resetUrl, resetToken),
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Password reset email sent to ${email}. Message ID: ${info.messageId}`);
      return true;

    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      return false;
    }
  }

  /**
   * Send welcome email after registration
   * @param email - Recipient email address
   * @param firstName - User's first name
   * @param lastName - User's last name
   * @returns Promise<boolean> - Success status
   */
  static async sendWelcomeEmail(
    email: string,
    firstName: string,
    lastName: string
  ): Promise<boolean> {
    try {
      await this.initializeTransporter();

      const mailOptions = {
        from: {
          name: config.FROM_NAME,
          address: config.FROM_EMAIL,
        },
        to: email,
        subject: 'Welcome to Penn State Meal Plan Tracker!',
        html: this.generateWelcomeHTML(firstName, lastName),
        text: this.generateWelcomeText(firstName, lastName),
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Welcome email sent to ${email}. Message ID: ${info.messageId}`);
      return true;

    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
      return false;
    }
  }

  /**
   * Generate HTML content for password reset email
   */
  private static generatePasswordResetHTML(
    firstName: string | undefined,
    resetUrl: string,
    resetToken: string
  ): string {
    const name = firstName ? ` ${firstName}` : '';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - Penn State Meal Plan</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .token { background: #e2e8f0; padding: 15px; border-radius: 6px; font-family: monospace; word-break: break-all; margin: 15px 0; }
          .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
          .warning { background: #fef3cd; border: 1px solid #fbbf24; color: #92400e; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏫 Penn State Meal Plan</h1>
          <p>Password Reset Request</p>
        </div>
        <div class="content">
          <h2>Hello${name}!</h2>
          <p>We received a request to reset your password for your Penn State Meal Plan account.</p>
          
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" class="button">Reset My Password</a>
          
          <p>Or copy and paste this link in your browser:</p>
          <div class="token">${resetUrl}</div>
          
          <div class="warning">
            <strong>⚠️ Security Notice:</strong>
            <ul>
              <li>This link will expire in 24 hours</li>
              <li>If you didn't request this reset, please ignore this email</li>
              <li>Never share this link with anyone</li>
            </ul>
          </div>
          
          <p>If you're having trouble with the button above, you can also use this reset token manually:</p>
          <div class="token">${resetToken}</div>
        </div>
        <div class="footer">
          <p>This is an unofficial app for Penn State students</p>
          <p>Questions? Contact us at ${config.FROM_EMAIL}</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate plain text content for password reset email
   */
  private static generatePasswordResetText(
    firstName: string | undefined,
    resetUrl: string,
    resetToken: string
  ): string {
    const name = firstName ? ` ${firstName}` : '';
    
    return `
Penn State Meal Plan - Password Reset Request

Hello${name}!

We received a request to reset your password for your Penn State Meal Plan account.

Reset your password by visiting this link:
${resetUrl}

Or use this reset token: ${resetToken}

SECURITY NOTICE:
- This link will expire in 24 hours
- If you didn't request this reset, please ignore this email
- Never share this link with anyone

This is an unofficial app for Penn State students.
Questions? Contact us at ${config.FROM_EMAIL}
    `.trim();
  }

  /**
   * Generate HTML content for welcome email
   */
  private static generateWelcomeHTML(firstName: string, lastName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome - Penn State Meal Plan</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
          .feature { background: white; padding: 20px; margin: 15px 0; border-radius: 6px; border-left: 4px solid #3b82f6; }
          .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏫 Welcome to Penn State Meal Plan!</h1>
          <p>Your account has been created successfully</p>
        </div>
        <div class="content">
          <h2>Hello ${firstName} ${lastName}!</h2>
          <p>Welcome to the Penn State Meal Plan Tracker! We're excited to help you manage your meal plan and track your spending.</p>
          
          <h3>🚀 What you can do:</h3>
          
          <div class="feature">
            <h4>📊 Track Your Balance</h4>
            <p>Monitor your meal plan balance and spending patterns in real-time.</p>
          </div>
          
          <div class="feature">
            <h4>📱 Mobile Access</h4>
            <p>Access your meal plan information anytime, anywhere from your mobile device.</p>
          </div>
          
          <div class="feature">
            <h4>📈 Spending Analytics</h4>
            <p>Get insights into your dining habits and spending trends.</p>
          </div>
          
          <div class="feature">
            <h4>🔔 Smart Notifications</h4>
            <p>Receive alerts about your balance and spending milestones.</p>
          </div>
          
          <p><strong>Ready to get started?</strong> Log in to your account and begin tracking your meal plan today!</p>
        </div>
        <div class="footer">
          <p>This is an unofficial app for Penn State students</p>
          <p>Questions? Contact us at ${config.FROM_EMAIL}</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate plain text content for welcome email
   */
  private static generateWelcomeText(firstName: string, lastName: string): string {
    return `
Penn State Meal Plan - Welcome!

Hello ${firstName} ${lastName}!

Welcome to the Penn State Meal Plan Tracker! We're excited to help you manage your meal plan and track your spending.

What you can do:
- Track Your Balance: Monitor your meal plan balance and spending patterns in real-time
- Mobile Access: Access your meal plan information anytime, anywhere from your mobile device  
- Spending Analytics: Get insights into your dining habits and spending trends
- Smart Notifications: Receive alerts about your balance and spending milestones

Ready to get started? Log in to your account and begin tracking your meal plan today!

This is an unofficial app for Penn State students.
Questions? Contact us at ${config.FROM_EMAIL}
    `.trim();
  }

  /**
   * Test email configuration
   * @returns Promise<boolean> - Success status
   */
  static async testConnection(): Promise<boolean> {
    try {
      await this.initializeTransporter();
      return true;
    } catch (error) {
      console.error('Email service test failed:', error);
      return false;
    }
  }
}

export default EmailService;
