import LegalLayout from '../components/LegalLayout';
import type { LegalSection } from '../components/LegalLayout';

const SECTIONS: LegalSection[] = [
  {
    heading: '1. Who we are',
    paragraphs: [
      'AI Campus Copilot is an institutional question answering service operated by the campus IT department for students, faculty and administrative staff. This policy explains what information the service collects, why it is collected, and the choices available to you.',
    ],
  },
  {
    heading: '2. Information we collect',
    bullets: [
      'Account data: your name, institutional email address, role, department and semester as stored in the campus directory.',
      'Authentication data: a hashed password used to verify your identity and a signed session token that expires automatically.',
      'Queries and answers: the questions you ask the copilot and the answers returned, so that responses can be audited and disputes can be reviewed.',
      'Feedback data: any report you submit through the dispute desk, including the reason and optional detail you provide.',
      'Uploaded documents: PDFs published by administrators, stored to build the approved knowledge base.',
    ],
  },
  {
    heading: '3. How we use your information',
    bullets: [
      'To authenticate you and route you to the correct portal for your role.',
      'To restrict retrieval to documents that your department and semester are allowed to read.',
      'To ground every copilot answer in approved documents and attach page level citations.',
      'To investigate reported inaccuracies and to keep an audit trail of administrative actions.',
      'To keep the service reliable, including debugging and abuse prevention.',
    ],
  },
  {
    heading: '4. Retrieval and access control',
    paragraphs: [
      'The service applies access rules before any document text is retrieved, not after. A student only ever receives passages from published documents that are institution wide or belong to their own department. Department administrators see only their own department, while super admins can access every department.',
    ],
  },
  {
    heading: '5. What we do not do',
    bullets: [
      'We do not sell, rent or share your personal information with advertisers or data brokers.',
      'We do not use your queries to train third party AI models beyond processing the single request in flight.',
      'We do not read documents outside your access scope to answer your questions.',
    ],
  },
  {
    heading: '6. Retention and deletion',
    paragraphs: [
      'Session tokens expire after the period configured by the institution. Query history is retained for as long as needed to audit answers and resolve disputes, and is removed when it is no longer required for those purposes. You may request deletion of your account and query history by contacting the IT Help Desk.',
    ],
  },
  {
    heading: '7. Security',
    paragraphs: [
      'Passwords are stored only as bcrypt hashes. API access requires a signed bearer token, and every restricted endpoint validates both the token and your role on the server side. Uploaded PDFs are served only from the application server and are never exposed through public links.',
    ],
  },
  {
    heading: '8. Your rights',
    bullets: [
      'Access the personal data we hold about you.',
      'Correct inaccurate profile information such as your name or semester.',
      'Request deletion of your account and associated query history.',
      'Withdraw consent by stopping use of the service and requesting account closure.',
    ],
  },
  {
    heading: '9. Contact',
    paragraphs: [
      'Questions about this policy can be sent to the IT Help Desk at it-helpdesk@campus.edu or raised in person at the central administration block.',
    ],
  },
];

export default function PrivacyPolicy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      updated="7 October 2026"
      summary="This policy describes how AI Campus Copilot handles your account data, your questions and the approved documents used to answer them. We collect only what is needed to authenticate you, ground answers in the right documents and resolve reported inaccuracies."
      sections={SECTIONS}
    />
  );
}
