export const ACCESS_LEVEL_OPTIONS = [
  { value: 'KINDERGARTEN', label: 'Kindergarten' },
  { value: 'LOWER_ELEMENTARY', label: 'Lower Elementary' },
  { value: 'UPPER_ELEMENTARY', label: 'Upper Elementary' },
  { value: 'JUNIOR_HIGH', label: 'Junior High' },
  { value: 'TEACHERS_STAFF', label: 'Teachers / Staff' },
] as const;

export type AccessLevelValue = (typeof ACCESS_LEVEL_OPTIONS)[number]['value'];
