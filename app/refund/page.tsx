import { LegalPage, LegalSection } from '@/components/legal-page'

export default function RefundPage() {
  return (
    <LegalPage
      eyebrow="Billing"
      title="Billing and refund policy"
      intro="ButtonPost is currently in Paddle Sandbox private beta. Sandbox transactions are test transactions and do not charge real money."
    >
      <LegalSection title="Private beta">
        <p>
          The current ButtonPost production deployment is connected to Paddle
          Sandbox for integration testing. Sandbox checkout, invoices, and
          subscription records are not real-money purchases.
        </p>
      </LegalSection>

      <LegalSection title="When live billing is enabled">
        <p>
          Before ButtonPost enables Paddle Live, this page will be updated with
          the final discretionary refund window. Live prices and renewal periods
          will be shown before purchase in Paddle Checkout. Billing support is
          available at support@buttonpost.app.
        </p>
      </LegalSection>

      <LegalSection title="Cancellation">
        <p>
          Active subscriptions can be managed from Settings → Billing → Manage
          billing, which opens the Paddle Customer Portal. Cancellation prevents
          future renewal according to the effective date shown by Paddle.
        </p>
      </LegalSection>

      <LegalSection title="Refunds">
        <p>
          ButtonPost does not currently promise an automatic discretionary
          refund window because live billing has not launched. Any refund rights
          required by applicable law remain unaffected. Duplicate charges,
          unauthorized charges, or technical billing errors should be raised
          promptly at support@buttonpost.app.
        </p>
      </LegalSection>

      <LegalSection title="Sensitive billing information">
        <p>
          Do not send payment card numbers, API keys, passwords, or webhook
          secrets through GitHub issues. Payment methods are managed through
          Paddle rather than stored by ButtonPost.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
