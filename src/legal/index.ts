/**
 * Documentos legales de FinancyAI — fuente única de verdad.
 *
 * El texto vive en `legal-content.json` para que la app y la landing
 * (`landingpage Financyai/scripts/build-legal.mjs`) muestren exactamente la
 * misma versión. Al cambiar un documento de forma sustancial:
 *   1. sube su `version` en el JSON,
 *   2. registra la versión en `legal_document_versions` (migración),
 *   3. si es `privacy` o `terms`, la app volverá a pedir la aceptación
 *      (ConsentGate compara la versión aceptada con la vigente).
 */
import content from './legal-content.json';

export type LegalDocId = 'privacy' | 'terms' | 'ai' | 'cookies' | 'rights' | 'deletion';

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  after?: string[];
}

export interface LegalDocument {
  id: LegalDocId;
  slug: string;
  title: string;
  shortTitle: string;
  version: string;
  effectiveDate: string;
  summary: string;
  sections: LegalSection[];
}

type Entity = Record<string, string>;

const ENTITY: Entity = content.entity;

/** Sustituye los marcadores {{CLAVE}} por los datos del responsable. */
export function resolverMarcadores(texto: string, entity: Entity = ENTITY): string {
  return texto.replace(/\{\{([A-Z_]+)\}\}/g, (m, clave: string) => entity[clave] ?? m);
}

function resolverDocumento(doc: LegalDocument): LegalDocument {
  const r = (t: string) => resolverMarcadores(t);
  return {
    ...doc,
    summary: r(doc.summary),
    sections: doc.sections.map(s => ({
      heading: r(s.heading),
      paragraphs: s.paragraphs?.map(r),
      bullets: s.bullets?.map(r),
      after: s.after?.map(r),
    })),
  };
}

const DOCS = content.documents as unknown as Record<LegalDocId, LegalDocument>;

export function getLegalDocument(id: LegalDocId): LegalDocument {
  return resolverDocumento(DOCS[id]);
}

/** Versiones vigentes de los documentos que requieren aceptación. */
export const LEGAL_VERSIONS = {
  privacy: DOCS.privacy.version,
  terms:   DOCS.terms.version,
  ai:      DOCS.ai.version,
} as const;

/** true mientras el texto no haya pasado revisión jurídica (se muestra un aviso). */
export const LEGAL_IS_DRAFT = content.status === 'draft';
export const LEGAL_STATUS_NOTE = content.statusNote;

/** true si aún quedan datos del responsable sin completar. */
export const LEGAL_ENTITY_INCOMPLETE = Object.values(ENTITY).some(v => v.startsWith('[COMPLETAR'));

export const PRIVACY_CONTACT_EMAIL = ENTITY.EMAIL_PRIVACIDAD;
export const SUPPORT_CONTACT_EMAIL = ENTITY.EMAIL_SOPORTE;
export const SIC_URL = 'https://www.sic.gov.co';

/** Nombres de pantalla del navegador interno para cada documento. */
export const LEGAL_SCREEN: Record<LegalDocId, string> = {
  privacy:  'legal-privacidad',
  terms:    'legal-terminos',
  ai:       'legal-ia',
  cookies:  'legal-cookies',
  rights:   'legal-derechos',
  deletion: 'legal-eliminacion',
};
