import { LegalPage, LegalSection } from '@/components/legal-page'

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="ButtonPost terms of use"
      intro="These private-beta terms cover use of ButtonPost as a multi-platform publishing tool. They are intentionally limited to the product that exists today."
    >
      <LegalSection title="Using ButtonPost">
        <p>
          You may use ButtonPost to prepare and publish content to accounts you
          are authorized to control. You are responsible for the content you
          publish and for complying with the rules, API terms, and acceptable-use
          policies of each destination platform.
        </p>
      </LegalSection>

      <LegalSection title="Prohibited use">
        <p>
          Do not use ButtonPost to send spam, evade platform enforcement, access
          accounts without authorization, distribute unlawful material, abuse
          third-party services, or interfere with ButtonPost infrastructure or
          other users.
        </p>
      </LegalSection>

      <LegalSection title="Connected accounts">
        <p>
          Connecting X or DEV authorizes ButtonPost to use the credential you
          provide for the publishing actions you request. Local Runner sessions
          stay on your computer. You may disconnect supported cloud connections
          from Settings → Connections.
        </p>
      </LegalSection>

      <LegalSection title="Your content">
        <p>
          You keep ownership of your content. You give ButtonPost only the
          limited permission needed to process, format, upload media for, and
          transmit content to the destinations you select.
        </p>
      </LegalSection>

      <LegalSection title="Subscriptions">
        <p>
          Paid plans are processed through Paddle. Plan names, prices, billing
          periods, taxes, renewal information, and payment details shown in
          Paddle Checkout or the Paddle Customer Portal govern the corresponding
          billing transaction.
        </p>
        <p>
          ButtonPost is currently validating billing in Paddle Sandbox. Live
          paid service will not be enabled until ButtonPost switches to Paddle
          Live and the public launch checklist is complete.
        </p>
      </LegalSection>

      <LegalSection title="Beta availability">
        <p>
          ButtonPost is in private beta. Integrations may break when third-party
          websites or APIs change, and features may be changed, paused, or
          removed. ButtonPost does not guarantee uninterrupted publishing or
          availability of any third-party platform.
        </p>
      </LegalSection>

      <LegalSection title="Account deletion and termination">
        <p>
          You may delete your ButtonPost account from Settings → Account. You are
          responsible for preserving any content or records you want to keep
          before deletion.
        </p>
        <p>
          ButtonPost may restrict access when necessary to protect the service,
          other users, connected platforms, or to address abuse.
        </p>
      </LegalSection>

      <LegalSection title="Liability">
        <p>
          To the extent permitted by applicable law, ButtonPost is provided on
          an as-is and as-available basis. You are responsible for reviewing
          content before publication and for any consequences of publishing to
          connected accounts. Nothing in these terms limits rights that cannot
          legally be limited.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
