import LegalLayout from '../components/LegalLayout';
import type { LegalSection } from '../components/LegalLayout';

const SECTIONS: LegalSection[] = [
  {
    heading: '1. Acceptance of these terms',
    paragraphs: [
      'By signing in to AI Campus Copilot you agree to these terms. If you do not agree, do not use the service and contact the IT Help Desk for alternative access to campus information.',
    ],
  },
  {
    heading: '2. Eligibility and accounts',
    bullets: [
      'Accounts are issued only to registered members of the campus community.',
      'You are responsible for keeping your password confidential and for activity performed under your account.',
      'Sharing your credentials with another person is not permitted and may result in account suspension.',
      'Notify the IT Help Desk immediately if you suspect your account has been compromised.',
    ],
  },
  {
    heading: '3. Permitted use',
    bullets: [
      'Use the copilot for academic, administrative and campus life questions related to your role.',
      'Use only the portal assigned to your role: students use the student assistant, staff use the admin portal.',
      'Do not attempt to bypass role checks, access another department’s documents or disrupt the service.',
      'Do not upload material you are not authorised to publish on behalf of the campus.',
    ],
  },
  {
    heading: '4. Nature of the answers',
    paragraphs: [
      'The copilot answers only from documents approved and published by the campus. Every response includes citations to the source document and page. An answer is a convenience, not an official communication.',
      'Where a regulation, timetable or fee schedule matters, the published PDF remains the authoritative record. If the copilot and a published document disagree, follow the document and report the discrepancy.',
    ],
  },
  {
    heading: '5. Reporting inaccuracies',
    paragraphs: [
      'If you believe an answer is wrong or outdated, use the report control on that response. Reports are routed to the responsible department administrator, recorded in the audit log and reviewed. Submitting a report does not guarantee a particular outcome, but every open report is expected to be resolved.',
    ],
  },
  {
    heading: '6. Administrator responsibilities',
    bullets: [
      'Department admins may publish, version and supersede documents only within their own department.',
      'Super admins may publish institution wide and may act on reports from any department.',
      'Administrative actions such as publishing and resolving reports are recorded in an audit log.',
    ],
  },
  {
    heading: '7. Availability',
    paragraphs: [
      'The service is provided on an as available basis. Scheduled maintenance, vector index rebuilds or upstream provider outages may make the copilot temporarily unavailable. The campus does not guarantee uninterrupted access.',
    ],
  },
  {
    heading: '8. Limitation of liability',
    paragraphs: [
      'To the maximum extent permitted by law, the campus is not liable for decisions taken in reliance on a copilot answer that contradicts the authoritative published document, nor for losses arising from misuse of your account.',
    ],
  },
  {
    heading: '9. Changes to these terms',
    paragraphs: [
      'These terms may be updated as the service changes. The current version is always available at this page, and continued use after an update means you accept the revised terms.',
    ],
  },
  {
    heading: '10. Contact',
    paragraphs: [
      'Questions about these terms can be sent to it-helpdesk@campus.edu or raised with the campus administration office.',
    ],
  },
];

export default function TermsAndConditions() {
  return (
    <LegalLayout
      title="Terms and Conditions"
      updated="7 October 2026"
      summary="These terms govern your use of AI Campus Copilot. The service answers questions using approved campus documents with citations, and it does not replace the official published regulation, timetable or notice."
      sections={SECTIONS}
    />
  );
}
