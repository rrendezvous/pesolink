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

// Same value as NSRP_SECTION_VIII_CATEGORY in backend/seed-skills.js. Shown first on the skill lists;
// the other categories keep their alphabetical order.
export const NSRP_SKILL_CATEGORY = 'NSRP Section VIII-related skills';

export function orderSkillCategories(categories: string[]): string[] {
  return [...categories].sort((a, b) => {
    if (a === NSRP_SKILL_CATEGORY || b === NSRP_SKILL_CATEGORY) return a === NSRP_SKILL_CATEGORY ? -1 : 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}
