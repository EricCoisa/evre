'use client';

import { ShowcaseSection, ShowcaseSectionProps } from './showcase-section';

export function SitesSection({
  label = 'Sites & Landing Pages',
  title = 'Para quem quer vender\ne aparecer online.',
  description = 'Sites institucionais, landing pages com design sob medida, integrados ao seu processo de vendas.',
  demos = [],
}: Partial<ShowcaseSectionProps>) {
  return (
    <ShowcaseSection
      anchorId="sites"
      label={label}
      title={title}
      description={description}
      mediaPosition="right"
      demos={demos}
    />
  );
}
