/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your AEGIS verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://lnkxkqlpnozvsdltjmju.supabase.co/storage/v1/object/public/email-assets/aegis-avatar.png?v=1"
          alt="AEGIS"
          width="48"
          height="48"
          style={logo}
        />
        <Heading style={h1}>Identity Verification</Heading>
        <Text style={text}>Use the code below to confirm your identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          This code will expire shortly. If you did not initiate this request,
          you can safely disregard this message.
        </Text>
        <Text style={signature}>A Silent Shield Intelligence System</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

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
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: '#D4A017',
  letterSpacing: '4px',
  margin: '0 0 30px',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0', lineHeight: '1.5' }
const signature = { fontSize: '11px', color: '#4A5568', margin: '16px 0 0', fontStyle: 'italic' as const }
