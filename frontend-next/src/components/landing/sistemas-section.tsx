'use client';

import { ShowcaseSection, ShowcaseSectionProps } from './showcase-section';

export function SistemasSection({
  label = 'Sistemas para empresas',
  title = 'Para quem precisa de mais\ndo que um site.',
  description = 'Sistemas de gestão, plataformas operacionais e aplicativos mobile desenvolvidos para as regras específicas do seu negócio.',
  demos = [],
}: Partial<ShowcaseSectionProps>) {
  return (
    <ShowcaseSection
      anchorId="sistemas"
      label={label}
      title={title}
      description={description}
      mediaPosition="left"
      demos={demos}
    />
  );
}
