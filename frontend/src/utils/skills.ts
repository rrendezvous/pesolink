// ============================================================
// Skill suggestions for the employer job form.
// Finds complete catalog skill names in the posting text, ignoring capitalization. A name only counts
// as a whole word ("Sales" is not found inside "Salesforce"); abbreviations and other wording are not
// recognized. These are suggestions only: nothing is selected until the employer taps it.
// ============================================================
type CatalogSkill = { id: number; skill_name: string };

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function findSkillNamesInText<T extends CatalogSkill>(text: string, skills: T[]): T[] {
  const haystack = String(text || '').toLowerCase();
  if (!haystack.trim()) return [];
  return skills.filter((skill) => {
    const name = String(skill.skill_name || '').trim().toLowerCase();
    if (!name) return false;
    const pattern = escapeRegex(name).replace(/\s+/g, '\\s+');
    return new RegExp(`(^|[^a-z0-9])${pattern}(?=$|[^a-z0-9])`).test(haystack);
  });
}
