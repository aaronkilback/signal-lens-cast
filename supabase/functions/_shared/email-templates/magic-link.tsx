/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your secure access link for AEGIS</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://lnkxkqlpnozvsdltjmju.supabase.co/storage/v1/object/public/email-assets/aegis-avatar.png?v=1"
          alt="AEGIS"
          width="48"
          height="48"
          style={logo}
        />
        <Heading style={h1}>Secure Access Link</Heading>
        <Text style={text}>
          Use the link below to access the AEGIS intelligence platform.
          This link will expire shortly for security purposes.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Access Platform
        </Button>
        <Text style={footer}>
          If you did not request this link, you can safely disregard this message.
        </Text>
        <Text style={signature}>A Silent Shield Intelligence System</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '40px 30px' }
const logo = { marginBottom: '24px', borderRadius: '8px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#0A192F',
  fontFamily: "'Georgia', 'Times New Roman', serif",
  margin: '0 0 20px',
}
const text = { fontSize: '14px', color: '#7B8BA3', lineHeight: '1.6', margin: '0 0 20px' }
const button = {
  backgroundColor: '#D4A017',
  color: '#0A192F',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0', lineHeight: '1.5' }
const signature = { fontSize: '11px', color: '#4A5568', margin: '16px 0 0', fontStyle: 'italic' as const }
