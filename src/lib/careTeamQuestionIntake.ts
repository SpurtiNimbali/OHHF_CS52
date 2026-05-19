/**
 * Care-team question generator intake — labels map to `care_team_questions__corpus` metadata
 * (see CS 52 data dictionary: provider_types, visit_types, target_person, knowledge_level).
 */

export type CareTeamIntakeOption = {
  /** Stored value — must match corpus where applicable. */
  value: string
  label: string
}

export type CareTeamIntakeAnswers = {
  providerTypes: string[]
  visitTypes: string[]
  targetPerson: string | null
  knowledgeLevel: string | null
  additionalNotes: string
}

export const EMPTY_CARE_TEAM_INTAKE: CareTeamIntakeAnswers = {
  providerTypes: [],
  visitTypes: [],
  targetPerson: null,
  knowledgeLevel: null,
  additionalNotes: '',
}

/** Which specialist or care team you're seeing (corpus: provider_types). */
export const CARE_TEAM_PROVIDER_OPTIONS: CareTeamIntakeOption[] = [
  { value: 'Cardiologist', label: 'Heart specialist (cardiology)' },
  { value: 'Surgeon', label: 'Surgeon' },
  { value: 'Pediatrician', label: 'Pediatrician' },
  { value: 'Primary Care Provider', label: 'Primary care doctor' },
  { value: 'Physical Therapist', label: 'Physical therapy / rehab' },
  { value: 'Mental Health Provider', label: 'Mental health or counseling' },
  { value: 'Nurse', label: 'Nurse or bedside care team' },
  { value: 'Care Coordinator', label: 'Care coordinator or navigator' },
  { value: 'School Staff', label: 'School or sports clearance' },
]

/** Kind of appointment (corpus: visit_types). */
export const CARE_TEAM_VISIT_TYPE_OPTIONS: CareTeamIntakeOption[] = [
  { value: 'Cardiology Visit', label: 'Cardiology clinic visit' },
  { value: 'Primary Care Visit', label: 'Primary care visit' },
  { value: 'Surgery Consultation', label: 'Surgery consultation' },
  { value: 'Procedure', label: 'Procedure or cath lab' },
  { value: 'Hospital Admission', label: 'Hospital admission' },
  { value: 'ICU / Hospital Rounds', label: 'ICU or inpatient rounds' },
  { value: 'Post-Discharge Follow-up', label: 'After hospital discharge' },
  { value: 'Prenatal Visit', label: 'Prenatal visit' },
  { value: 'Emergency Concern', label: 'Urgent or emergency concern' },
  { value: 'Mental Health Support', label: 'Mental health appointment' },
  { value: 'School / Sports Clearance', label: 'School or sports clearance' },
  { value: 'Care Coordination', label: 'Care coordination meeting' },
  { value: 'Second Opinion', label: 'Second opinion' },
  { value: 'Transition to Adult Care', label: 'Transition to adult care' },
]

/** Who the questions are for (corpus: target_person). */
export const CARE_TEAM_TARGET_PERSON_OPTIONS: CareTeamIntakeOption[] = [
  { value: 'Caregiver', label: 'Me (parent or caregiver)' },
  { value: 'Child', label: 'My child' },
  { value: 'Family', label: 'Other family members' },
]

/** How familiar you are with this type of care (corpus: knowledge_level). */
export const CARE_TEAM_KNOWLEDGE_OPTIONS: CareTeamIntakeOption[] = [
  { value: 'Beginner', label: 'Pretty new to this' },
  { value: 'Intermediate', label: 'Some experience' },
  { value: 'Experienced', label: 'Quite familiar' },
]

export function isCareTeamIntakeComplete(intake: CareTeamIntakeAnswers): boolean {
  return (
    intake.providerTypes.length > 0 &&
    intake.visitTypes.length > 0 &&
    Boolean(intake.targetPerson?.trim()) &&
    Boolean(intake.knowledgeLevel?.trim())
  )
}

export function labelsForIntakeValues(
  options: CareTeamIntakeOption[],
  values: string[],
): string[] {
  return values.map((v) => options.find((o) => o.value === v)?.label ?? v)
}

/** Human-readable summary for prompts and legacy generators. */
export function buildCareTeamIntakeSummary(intake: CareTeamIntakeAnswers): string {
  const parts: string[] = []
  if (intake.providerTypes.length) {
    parts.push(`Care team: ${labelsForIntakeValues(CARE_TEAM_PROVIDER_OPTIONS, intake.providerTypes).join(', ')}`)
  }
  if (intake.visitTypes.length) {
    parts.push(`Visit type(s): ${labelsForIntakeValues(CARE_TEAM_VISIT_TYPE_OPTIONS, intake.visitTypes).join(', ')}`)
  }
  if (intake.targetPerson) {
    const label =
      CARE_TEAM_TARGET_PERSON_OPTIONS.find((o) => o.value === intake.targetPerson)?.label ??
      intake.targetPerson
    parts.push(`Preparing questions for: ${label}`)
  }
  if (intake.knowledgeLevel) {
    const label =
      CARE_TEAM_KNOWLEDGE_OPTIONS.find((o) => o.value === intake.knowledgeLevel)?.label ??
      intake.knowledgeLevel
    parts.push(`Familiarity: ${label}`)
  }
  if (intake.additionalNotes.trim()) parts.push(`Notes: ${intake.additionalNotes.trim()}`)
  return parts.join('. ')
}

/** Map UI "Child" to corpus target_person values for retrieval. */
export function corpusTargetPersonValues(targetPerson: string | null): string[] {
  if (!targetPerson) return []
  if (targetPerson === 'Child') return ['Caregiver', 'Teen', 'Young Adult']
  return [targetPerson]
}
