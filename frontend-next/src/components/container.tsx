import { cn } from "@/lib/utils";
import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { useIsMobile } from "@/hooks/use-mobile";

export type ContainerVariant = 'default' | 'dataTable' | 'sortableTable' | 'form' | 'config' | 'configGroup' | 'dashboard' | 'stats' | 'compact' | 'notification';

// Propriedades básicas do container
interface ContainerBaseProps {
    children: React.ReactNode;
    className?: string;
    variant?: ContainerVariant;
    title?: string;
    widthClass?: string; // Classe Tailwind para controlar largura horizontal
}

// Propriedades relacionadas a espaçamento
interface ContainerSpacingProps {
    noSpacing?: boolean; // Remove a margem externa space-y-6
    noTitleSpacing?: boolean; // Remove a margem inferior do título
    padding?: boolean; // Controla se deve exibir padding (padrão: true)
}

// Propriedades relacionadas a borda/estilo
interface ContainerBorderProps {
    border?: boolean; // Controla se deve exibir o contorno (padrão: true)
}

// Propriedades relacionadas ao comportamento colapsável
interface ContainerCollapsibleProps {
    collapsible?: boolean; // Torna o container colapsável
    defaultExpanded?: boolean; // Estado inicial quando colapsável (padrão: true)
}

// Propriedades de posicionamento quando usado dentro de um grid pai
interface ContainerGridItemProps {
    gridItem?: {
        colStart?: number;
        colEnd?: number;
        rowStart?: number;
        rowEnd?: number;
        area?: string;
    };
}

// Combina todas as propriedades em um único tipo usado pelo componente
export type ContainerProps =
    & ContainerBaseProps
    & Partial<ContainerSpacingProps & ContainerBorderProps & ContainerCollapsibleProps & ContainerGridItemProps>;

const containerVariants = {
  default: 'h-full min-h-[50px]',
  dataTable: 'h-full min-h-[50px]', // Para tabelas com paginação e muitos dados
  sortableTable: 'h-full min-h-[50px]', // Para tabelas ordenáveis com menos dados
  form: 'h-full min-h-[50px]', // Para formulários padrão
  config: 'h-auto min-h-[50px]', // Para uma única configuração
  configGroup: 'h-auto min-h-[50px]', // Para grupo de configurações (2-3 itens)
  dashboard: 'h-full min-h-[50px]', // Para widgets de dashboard
  stats: 'h-auto min-h-[50px]', // Para estatísticas e métricas
  compact: 'h-auto min-h-[50px]', // Para notificações e alertas pequenos
  notification: 'h-auto min-h-[50px]' // Para avisos e mensagens rápidas
};

type ContainerGridProps = {
    children: React.ReactNode;
    columns?: number | string;
    rows?: string;
    gap?: string; // CSS gap value, ex: '1rem' or '0.75rem'
    className?: string;
    style?: React.CSSProperties;
}

export function ContainerGrid({ children, columns = 3, rows = 'auto', gap = '1rem', className, style }: ContainerGridProps) {
    const gridStyle: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: typeof columns === 'number' ? `repeat(${columns}, minmax(0, 1fr))` : columns,
        gridTemplateRows: rows,
        gap,
        width: '100%',
        ...style
    };

    return (
        <div className={cn('w-full', className)} style={gridStyle}>
            {children}
        </div>
    );
}

export function Container({
    children,
    className,
    variant = 'default',
    title,
    noSpacing = false,
    noTitleSpacing = false,
    border = true,
    collapsible = false,
    defaultExpanded = true,
    widthClass = 'w-full',
    gridItem,
    padding,
}: ContainerProps) {
    const [isExpanded, setIsExpanded] = useState<boolean>(!!defaultExpanded);
    const isMobile = useIsMobile()
    padding = padding == undefined ? (isMobile ? false : true) : padding;
    // Se apenas children foi fornecido (sem outras props customizadas), retorna children diretamente
    const isSimpleContainer = !className && 
        variant === 'default' && 
        !title && 
        !noSpacing && 
        !noTitleSpacing && 
        border === true && 
        !collapsible && 
        defaultExpanded === true && 
        widthClass === 'w-full' && 
        !gridItem;

    if (isSimpleContainer) {
        return <div className="space-y-6">
       <div className="rounded-lg border border-border bg-card-foreground/1">
           <div className={padding ? "sm:p-6 p-4" : ""}>
               {children}
           </div>
       </div>
   </div>;
    }

    const toggleExpanded = () => {
        if (collapsible) {
            setIsExpanded(!isExpanded);
        }
    };

    return (
        <div className={cn(!noSpacing && 'space-y-6', 'flex flex-col', 'rounded-xl', className)}>
            <div
                className={cn(
                    'rounded-lg flex flex-col transition-shadow duration-300',
                    border &&
                        'border-primary-200 dark:border-primary-700 from-card via-card/98 to-primary-50/20 dark:to-primary-950/10 shadow-lg hover:shadow-xl',
                    containerVariants[variant],
                    widthClass,
                    !isExpanded && 'min-h-0 h-auto max-h-20 overflow-hidden'
                )}
                style={{
                    ...(gridItem?.colStart ? { gridColumnStart: gridItem.colStart } : {}),
                    ...(gridItem?.colEnd ? { gridColumnEnd: gridItem.colEnd } : {}),
                    ...(gridItem?.rowStart ? { gridRowStart: gridItem.rowStart } : {}),
                    ...(gridItem?.rowEnd ? { gridRowEnd: gridItem.rowEnd } : {}),
                    ...(gridItem?.area ? { gridArea: gridItem.area } : {}),
                }}
            >
                <div
                    className={cn(
                        'flex flex-col',
                        // padding igual ao isSimpleContainer: sm:p-6 p-4
                        padding == true ? 'sm:p-6 p-4' : ''
                    )}
                >
                    {title && (
                        <div
                            className={cn(
                                'flex items-center justify-between',
                                border && isExpanded && 'border-b border-primary-200 dark:border-primary-700 pb-2',
                                !noTitleSpacing && isExpanded && 'mb-4'
                            )}
                        >
                            <h2 className="text-xl font-semibold text-primary-700 dark:text-primary-300">{title}</h2>
                            {collapsible && (
                                <button
                                    onClick={toggleExpanded}
                                    className="p-2 rounded-lg border border-primary-200/60 dark:border-primary-700/60
                                             transition-all duration-200 ease-in-out"
                                    aria-label={isExpanded ? 'Colapsar container' : 'Expandir container'}
                                >
                                    {isExpanded ? (
                                        <ChevronUpIcon className="h-5 w-5 text-primary-700 dark:text-primary-300 
                                                                 transition-colors duration-200" />
                                    ) : (
                                        <ChevronDownIcon className="h-5 w-5 text-primary-700 dark:text-primary-300 
                                                                  transition-colors duration-200" />
                                    )}
                                </button>
                            )}
                        </div>
                    )}
                    {isExpanded && <div className="flex-1 flex flex-col">{children}</div>}
                </div>
            </div>
        </div>
    );
}