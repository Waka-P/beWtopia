export type EditableProfile = {
  name: string;
  occupation: string;
  achievements: string;
  externalLinks: string[];
  selfIntro: string;
  image: string | null;
  rating: number;
};

export type JobOption = {
  id: string;
  name: string;
};

export type JobFormValues = {
  jobIds: string[];
  newJobNames: string[];
};
