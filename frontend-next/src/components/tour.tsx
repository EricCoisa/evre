"use client";

import { AnimatePresence, motion } from "motion/react";
import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";

import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

import { CircleHelp, Torus } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { useCapabilities } from "@/lib/actions/capability/queries";
import type { SubNavSection } from "@/components/sub-nav-layout";

export interface TourStep {
	content: React.ReactNode;
	selectorId: string;
	mobileSelectorId?: string;
	width?: number;
	height?: number;
	onClickWithinArea?: () => void;
	position?: "top" | "bottom" | "left" | "right";
	onEnter?: () => void;
	/**
	 * Se true, o passo é ocultado do tour.
	 */
	hidden?: boolean;
	/**
	 * Capability do sistema exigida para exibir o passo (ex: CAPABILITIES.messaging).
	 * Se capabilities[capability]?.available === false, o passo é ocultado automaticamente.
	 */
	capability?: string;
	/**
	 * Múltiplas capabilities exigidas. Se alguma estiver com available === false, o passo é ocultado.
	 */
	capabilities?: string[];
	/**
	 * Condição personalizada (booleana ou função) para exibição do passo.
	 */
	condition?: boolean | (() => boolean);
	/**
	 * ID da aba correspondente (quando usado em conjunto com SubNavLayout).
	 */
	tabId?: string;
}

/**
 * Determina se um passo do tour deve ser exibido com base em:
 * 1. Propriedade `hidden`
 * 2. Condição `condition` (booleana ou função)
 * 3. Status da capability no backend (`available !== false`)
 * 4. Pertença a abas visíveis no layout (`visibleTabIds`)
 */
function isStepConditionActive(condition?: boolean | (() => boolean)): boolean {
	if (typeof condition === "function") return condition();
	if (typeof condition === "boolean") return condition;
	return true;
}

function areCapabilitiesAvailable(
	capabilities: Record<string, { available?: boolean }> | null | undefined,
	capability?: string,
	capabilityList?: string[]
): boolean {
	if (!capabilities) return true;
	if (capability && capabilities[capability]?.available === false) {
		return false;
	}
	if (capabilityList && capabilityList.some((cap) => capabilities[cap]?.available === false)) {
		return false;
	}
	return true;
}

export function isTourStepVisible(
	step: TourStep,
	capabilities?: Record<string, { available?: boolean }> | null,
	visibleTabIds?: Set<string> | null
): boolean {
	if (step.hidden) return false;
	if (!isStepConditionActive(step.condition)) return false;
	if (visibleTabIds && step.tabId && !visibleTabIds.has(step.tabId)) return false;
	return areCapabilitiesAvailable(capabilities, step.capability, step.capabilities);
}

/**
 * Filtra uma lista de passos de tour preservando apenas os que estão ativos/visíveis.
 */
export function filterTourSteps(
	steps: TourStep[],
	capabilities?: Record<string, { available?: boolean }> | null,
	visibleTabIds?: Set<string> | null
): TourStep[] {
	return steps.filter((step) => isTourStepVisible(step, capabilities, visibleTabIds));
}

/**
 * Utilitário agnóstico para sincronizar passos do tour com as seções do SubNavLayout.
 * Oculta passos de abas marcadas com `hidden: true` em `sections`.
 */
export function filterStepsBySubNavSections(
	steps: TourStep[],
	sections: SubNavSection[],
	capabilities?: Record<string, { available?: boolean }> | null
): TourStep[] {
	const visibleTabs = new Set<string>();
	const visibleIdAttrs = new Set<string>();

	for (const section of sections) {
		for (const item of section.items) {
			if (!item.hidden) {
				visibleTabs.add(item.id);
				if (item.idAttr) {
					visibleIdAttrs.add(item.idAttr);
				}
			}
		}
	}

	return steps.filter((step) => {
		if (step.tabId && !visibleTabs.has(step.tabId)) {
			return false;
		}
		const isSubNavTarget = sections.some((s) =>
			s.items.some((i) => i.id === step.selectorId || i.idAttr === step.selectorId)
		);
		if (
			isSubNavTarget &&
			!visibleTabs.has(step.selectorId) &&
			!visibleIdAttrs.has(step.selectorId)
		) {
			return false;
		}
		return isTourStepVisible(step, capabilities, visibleTabs);
	});
}

interface TourContextType {
	currentStep: number;
	totalSteps: number;
	nextStep: () => void;
	previousStep: () => void;
	endTour: () => void;
	isActive: boolean;
	/** Start a named tour. If tourId is omitted, starts the last registered tour. */
	startTour: (tourId?: string) => void;
	registerTour: (tourId: string, steps: TourStep[]) => void;
	steps: TourStep[];
}

interface TourProviderProps {
	children: React.ReactNode;
	className?: string;
}

const TourContext = createContext<TourContextType | null>(null);

const PADDING = 16;
const CONTENT_WIDTH = 320;
const CONTENT_HEIGHT = 180;

interface ElementPosition {
	top: number;
	left: number;
	width: number;
	height: number;
	isVisible: boolean;
}

function getElementPosition(id: string): ElementPosition | null {
	if (!id || typeof document === "undefined") return null;
	const element = document.getElementById(id);
	if (!element) return null;
	const rect = element.getBoundingClientRect();
	const style = typeof window !== "undefined" ? window.getComputedStyle(element) : null;
	const isVisible =
		rect.width > 0 &&
		rect.height > 0 &&
		style?.display !== "none" &&
		style?.visibility !== "hidden";

	return {
		top: rect.top,
		left: rect.left,
		width: rect.width,
		height: rect.height,
		isVisible,
	};
}

function calculateContentPosition(
	elementPos: ElementPosition,
	position: "top" | "bottom" | "left" | "right" = "bottom",
) {
	const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1024;
	const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 768;

	let left = elementPos.left;
	let top = elementPos.top;

	switch (position) {
		case "top":
			top = elementPos.top - CONTENT_HEIGHT - PADDING;
			left = elementPos.left + elementPos.width / 2 - CONTENT_WIDTH / 2;
			break;
		case "bottom":
			top = elementPos.top + elementPos.height + PADDING;
			left = elementPos.left + elementPos.width / 2 - CONTENT_WIDTH / 2;
			break;
		case "left":
			left = elementPos.left - CONTENT_WIDTH - PADDING;
			top = elementPos.top + elementPos.height / 2 - CONTENT_HEIGHT / 2;
			break;
		case "right":
			left = elementPos.left + elementPos.width + PADDING;
			top = elementPos.top + elementPos.height / 2 - CONTENT_HEIGHT / 2;
			break;
	}

	return {
		top: Math.max(
			PADDING,
			Math.min(top, viewportHeight - CONTENT_HEIGHT - PADDING),
		),
		left: Math.max(
			PADDING,
			Math.min(left, viewportWidth - CONTENT_WIDTH - PADDING),
		),
		width: Math.min(CONTENT_WIDTH, viewportWidth - PADDING * 2),
		height: CONTENT_HEIGHT,
	};
}

function isClickWithinBounds(
	e: MouseEvent,
	elementPosition: ElementPosition,
	step?: TourStep,
): boolean {
	const clickX = e.clientX;
	const clickY = e.clientY;
	const targetWidth = step?.width || elementPosition.width;
	const targetHeight = step?.height || elementPosition.height;

	return (
		clickX >= elementPosition.left &&
		clickX <= elementPosition.left + targetWidth &&
		clickY >= elementPosition.top &&
		clickY <= elementPosition.top + targetHeight
	);
}

interface TourOverlayProps {
	currentStep: number;
	steps: TourStep[];
	elementPosition: ElementPosition | null;
	isMobile: boolean;
	className?: string;
	previousStep: () => void;
	nextStep: () => void;
	t: (key: string) => string;
}

interface TourBackdropProps {
	hasTarget: boolean;
	elementPosition: ElementPosition | null;
	stepWidth: number;
	stepHeight: number;
	className?: string;
}

function TourBackdrop({
	hasTarget,
	elementPosition,
	stepWidth,
	stepHeight,
	className,
}: TourBackdropProps) {
	if (!hasTarget || !elementPosition) {
		return (
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				className="fixed inset-0 z-50 bg-black/50"
			/>
		);
	}

	return (
		<>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				className="fixed inset-0 z-50 overflow-hidden bg-black/50"
				style={{
					clipPath: `polygon(
            0% 0%,
            0% 100%,
            100% 100%,
            100% 0%,
            ${elementPosition.left}px 0%,
            ${elementPosition.left}px ${elementPosition.top}px,
            ${elementPosition.left + stepWidth}px ${elementPosition.top}px,
            ${elementPosition.left + stepWidth}px ${elementPosition.top + stepHeight}px,
            ${elementPosition.left}px ${elementPosition.top + stepHeight}px,
            ${elementPosition.left}px 0%
          )`,
				}}
			/>
			<motion.div
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.95 }}
				style={{
					position: "fixed",
					top: elementPosition.top,
					left: elementPosition.left,
					width: stepWidth,
					height: stepHeight,
				}}
				className={cn("z-[100] pointer-events-none rounded-md border-2 border-primary/70 shadow-sm", className)}
			/>
		</>
	);
}

interface TourCardProps {
	isMobile: boolean;
	hasTarget: boolean;
	contentPosition: ReturnType<typeof calculateContentPosition> | null;
	children: React.ReactNode;
}

function TourCard({ isMobile, hasTarget, contentPosition, children }: TourCardProps) {
	if (isMobile) {
		return (
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: 20 }}
				transition={{ duration: 0.3 }}
				data-tour-ui
				className="bg-background pointer-events-auto fixed bottom-4 left-4 right-4 z-[100] max-w-lg mx-auto rounded-xl border p-4 shadow-xl"
			>
				{children}
			</motion.div>
		);
	}

	if (hasTarget && contentPosition) {
		return (
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{
					opacity: 1,
					y: 0,
					top: contentPosition.top,
					left: contentPosition.left,
				}}
				transition={{
					duration: 0.4,
					ease: [0.16, 1, 0.3, 1],
					opacity: { duration: 0.2 },
				}}
				exit={{ opacity: 0, y: 10 }}
				style={{
					position: "fixed",
					width: contentPosition.width,
				}}
				data-tour-ui
				className="bg-background pointer-events-auto fixed z-[100] rounded-lg border p-4 shadow-lg"
			>
				{children}
			</motion.div>
		);
	}

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.95 }}
			data-tour-ui
			className="bg-background pointer-events-auto fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[340px] max-w-[90vw] rounded-lg border p-4 shadow-xl"
		>
			{children}
		</motion.div>
	);
}

interface TourCardContentProps {
	currentStep: number;
	totalSteps: number;
	content: React.ReactNode;
	previousStep: () => void;
	nextStep: () => void;
	t: (key: string) => string;
}

function TourCardContent({
	currentStep,
	totalSteps,
	content,
	previousStep,
	nextStep,
	t,
}: TourCardContentProps) {
	const isLastStep = currentStep === totalSteps - 1;
	return (
		<>
			<div className="text-muted-foreground absolute right-4 top-4 text-xs font-medium">
				{currentStep + 1} / {totalSteps}
			</div>
			<AnimatePresence mode="wait">
				<div>
					<motion.div
						key={`tour-content-${currentStep}`}
						initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
						animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
						exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
						className="overflow-hidden pr-6"
						transition={{
							duration: 0.2,
							height: { duration: 0.4 },
						}}
					>
						{content}
					</motion.div>
					<div className="mt-4 flex justify-between">
						{currentStep > 0 && (
							<button
								onClick={previousStep}
								className="text-sm text-muted-foreground hover:text-foreground"
							>
								{t("previous")}
							</button>
						)}
						<button
							onClick={nextStep}
							className="ml-auto text-sm font-medium text-primary hover:text-primary/90"
						>
							{isLastStep ? t("finish") : t("next")}
						</button>
					</div>
				</div>
			</AnimatePresence>
		</>
	);
}

function resolveStepDimensions(
	step: TourStep | undefined,
	elementPosition: ElementPosition | null
) {
	let width = 0;
	let height = 0;
	if (step && step.width) {
		width = step.width;
	} else if (elementPosition) {
		width = elementPosition.width;
	}

	if (step && step.height) {
		height = step.height;
	} else if (elementPosition) {
		height = elementPosition.height;
	}

	return { width, height };
}

function resolveContentPosition(
	step: TourStep | undefined,
	elementPosition: ElementPosition | null,
	hasTarget: boolean
) {
	if (!hasTarget || !elementPosition) return null;
	return calculateContentPosition(elementPosition, step ? step.position : undefined);
}

function TourOverlay({
	currentStep,
	steps,
	elementPosition,
	isMobile,
	className,
	previousStep,
	nextStep,
	t,
}: TourOverlayProps) {
	const step = steps[currentStep];
	const hasTarget = Boolean(elementPosition && elementPosition.isVisible);
	const { width: stepWidth, height: stepHeight } = resolveStepDimensions(step, elementPosition);
	const contentPosition = resolveContentPosition(step, elementPosition, hasTarget);

	return (
		<>
			<TourBackdrop
				hasTarget={hasTarget}
				elementPosition={elementPosition}
				stepWidth={stepWidth}
				stepHeight={stepHeight}
				className={className}
			/>
			<TourCard
				isMobile={isMobile}
				hasTarget={hasTarget}
				contentPosition={contentPosition}
			>
				<TourCardContent
					currentStep={currentStep}
					totalSteps={steps.length}
					content={step ? step.content : null}
					previousStep={previousStep}
					nextStep={nextStep}
					t={t}
				/>
			</TourCard>
		</>
	);
}

export function TourProvider({ children, className }: TourProviderProps) {
	const registry = useRef<Record<string, TourStep[]>>({});
	const [steps, setSteps] = useState<TourStep[]>([]);
	const [currentStep, setCurrentStep] = useState(-1);
	const [isMobile, setIsMobile] = useState(false);
	const [elementPosition, setElementPosition] = useState<ElementPosition | null>(null);

	const { data: capabilities } = useCapabilities();

	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth < 768);
		};
		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	const registerTour = useCallback((tourId: string, tourSteps: TourStep[]) => {
		registry.current[tourId] = tourSteps;
	}, []);

	const startTour = useCallback((tourId?: string) => {
		const key = tourId ?? Object.keys(registry.current)[0];
		const rawSteps = key ? registry.current[key] : undefined;
		if (!rawSteps || rawSteps.length === 0) return;

		const visibleSteps = filterTourSteps(rawSteps, capabilities);
		if (visibleSteps.length === 0) return;

		setSteps(visibleSteps);
		setCurrentStep(0);
	}, [capabilities]);

	const updateElementPosition = useCallback(() => {
		if (currentStep >= 0 && currentStep < steps.length) {
			const step = steps[currentStep];
			const targetId =
				isMobile && step?.mobileSelectorId
					? step.mobileSelectorId
					: step?.selectorId ?? "";
			const position = getElementPosition(targetId);
			setElementPosition(position);
		} else {
			setElementPosition(null);
		}
	}, [currentStep, isMobile, steps]);

	// Dispara o callback onEnter do passo (ex: troca de aba ou carregamento de estado)
	useEffect(() => {
		if (currentStep >= 0 && currentStep < steps.length) {
			const step = steps[currentStep];
			step?.onEnter?.();

			// Recalcula posição nos próximos ticks para acomodar transições/renderizações de abas
			const frameId = window.requestAnimationFrame(updateElementPosition);
			const t1 = setTimeout(updateElementPosition, 50);
			const t2 = setTimeout(updateElementPosition, 150);
			const t3 = setTimeout(updateElementPosition, 300);

			return () => {
				window.cancelAnimationFrame(frameId);
				clearTimeout(t1);
				clearTimeout(t2);
				clearTimeout(t3);
			};
		}
	}, [currentStep, steps, updateElementPosition]);

	// Auto-scroll suave até o elemento alvo quando mudar de passo
	useEffect(() => {
		if (currentStep >= 0 && currentStep < steps.length) {
			const step = steps[currentStep];
			const targetId =
				isMobile && step?.mobileSelectorId
					? step.mobileSelectorId
					: step?.selectorId ?? "";
			if (!targetId || typeof document === "undefined") return;

			const scrollToTarget = () => {
				const element = document.getElementById(targetId);
				if (element && typeof element.scrollIntoView === "function") {
					const rect = element.getBoundingClientRect();
					if (rect.width > 0 || rect.height > 0) {
						element.scrollIntoView({
							behavior: "smooth",
							block: isMobile ? "start" : "center",
							inline: "nearest",
						});
					}
				}
			};

			scrollToTarget();
			const timeout = setTimeout(scrollToTarget, 100);
			return () => clearTimeout(timeout);
		}
	}, [currentStep, isMobile, steps]);

	useEffect(() => {
		const frameId = window.requestAnimationFrame(updateElementPosition);
		window.addEventListener("resize", updateElementPosition);
		// capture: true permite detectar scroll dentro de modals e containers com overflow-y-auto
		window.addEventListener("scroll", updateElementPosition, true);

		return () => {
			window.cancelAnimationFrame(frameId);
			window.removeEventListener("resize", updateElementPosition);
			window.removeEventListener("scroll", updateElementPosition, true);
		};
	}, [updateElementPosition]);

	const nextStep = useCallback(() => {
		setCurrentStep((prev) => {
			if (prev >= steps.length - 1) return -1;
			return prev + 1;
		});
	}, [steps.length]);

	const previousStep = useCallback(() => {
		setCurrentStep((prev) => (prev > 0 ? prev - 1 : prev));
	}, []);

	const endTour = useCallback(() => {
		setCurrentStep(-1);
	}, []);

	const handleClick = useCallback(
		(e: MouseEvent) => {
			if (currentStep < 0 || !elementPosition || !elementPosition.isVisible) return;
			const step = steps[currentStep];
			if (!step?.onClickWithinArea) return;

			if (isClickWithinBounds(e, elementPosition, step)) {
				step.onClickWithinArea();
			}
		},
		[currentStep, elementPosition, steps],
	);

	useEffect(() => {
		window.addEventListener("click", handleClick);
		return () => {
			window.removeEventListener("click", handleClick);
		};
	}, [handleClick]);

	const { t } = useTranslation("tour");

	return (
		<TourContext.Provider
			value={{
				currentStep,
				totalSteps: steps.length,
				nextStep,
				previousStep,
				endTour,
				isActive: currentStep >= 0,
				startTour,
				registerTour,
				steps,
			}}
		>
			{children}
			<AnimatePresence>
				{currentStep >= 0 && (
					<TourOverlay
						currentStep={currentStep}
						steps={steps}
						elementPosition={elementPosition}
						isMobile={isMobile}
						className={className}
						previousStep={previousStep}
						nextStep={nextStep}
						t={t}
					/>
				)}
			</AnimatePresence>
		</TourContext.Provider>
	);
}

export function useTour() {
	const context = useContext(TourContext);
	if (!context) {
		throw new Error("useTour must be used within a TourProvider");
	}
	return context;
}

/** Ignora o "clique fora" do Radix Dialog quando o alvo é a UI do tour; use em `onInteractOutside`. */
export function ignoreTourInteraction(event: Event): void {
	const target = event.target;
	if (target instanceof Element && target.closest("[data-tour-ui]")) {
		event.preventDefault();
	}
}

/** Dialog shown by HelpButton before starting the tour. */
export function TourAlertDialog({
	tourId,
	isOpen,
	setIsOpen,
}: {
	tourId: string;
	isOpen: boolean;
	setIsOpen: (isOpen: boolean) => void;
}) {
	const { startTour, currentStep } = useTour();
	const { t } = useTranslation("tour");

	if (currentStep > -1) return null;

	const handleStart = () => {
		setIsOpen(false);
		startTour(tourId);
	};

	return (
		<AlertDialog open={isOpen}>
			<AlertDialogContent className="max-w-md p-6">
				<AlertDialogHeader className="flex flex-col items-center justify-center">
					<div className="relative mb-4">
						<motion.div
							initial={{ scale: 0.7, filter: "blur(10px)" }}
							animate={{
								scale: 1,
								filter: "blur(0px)",
								y: [0, -8, 0],
								rotate: [42, 48, 42],
							}}
							transition={{
								duration: 0.4,
								ease: "easeOut",
								y: {
									duration: 2.5,
									repeat: Number.POSITIVE_INFINITY,
									ease: "easeInOut",
								},
								rotate: {
									duration: 3,
									repeat: Number.POSITIVE_INFINITY,
									ease: "easeInOut",
								},
							}}
						>
							<Torus className="size-32 stroke-1 text-primary" />
						</motion.div>
					</div>
					<AlertDialogTitle className="text-center text-xl font-medium">
						{t("welcomeTitle")}
					</AlertDialogTitle>
					<AlertDialogDescription className="text-muted-foreground mt-2 text-center text-sm">
						{t("welcomeDescription")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<div className="mt-6 space-y-3">
					<Button onClick={handleStart} className="w-full">
						{t("startTour")}
					</Button>
					<Button
						onClick={() => setIsOpen(false)}
						variant="ghost"
						className="w-full"
					>
						{t("skipTour")}
					</Button>
				</div>
			</AlertDialogContent>
		</AlertDialog>
	);
}

/** Drop-in "?" button that opens a named tour. Place next to page titles. */
export function HelpButton({
	tourId,
	className,
	startDirect = false,
}: {
	tourId: string;
	className?: string;
	startDirect?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const { startTour } = useTour();
	const { t } = useTranslation("tour");

	if (startDirect) {
		return (
			<button
				type="button"
				onClick={() => startTour(tourId)}
				aria-label={t("helpButtonLabel")}
				className={cn(
					"inline-flex items-center justify-center rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors",
					className,
				)}
			>
				<CircleHelp className="size-5" />
			</button>
		);
	}

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				aria-label={t("helpButtonLabel")}
				className={cn(
					"inline-flex items-center justify-center rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors",
					className,
				)}
			>
				<CircleHelp className="size-5" />
			</button>
			<TourAlertDialog tourId={tourId} isOpen={open} setIsOpen={setOpen} />
		</>
	);
}
