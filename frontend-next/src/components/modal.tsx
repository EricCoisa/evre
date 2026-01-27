"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ModalProps {
    title?: string | null;
    description?: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
    className?: string;
    maxWidth?: string;
    width?: string;
    height?: string;
}

export default function Modal({ title, description, open, onOpenChange, children, className, maxWidth, width, height }: ModalProps) {
    
  const style: React.CSSProperties = {
    maxWidth: maxWidth || '98vw',
    width: width || '98vw',
    height: height,
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`overflow-y-auto max-h-[95vh] w-full p-0 ${className || ''}`}
        style={style}
      >
        {title || description ? (
          <DialogHeader className="px-6 pt-6 pb-0">
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>
              {description}
            </DialogDescription>}
          </DialogHeader>
        ) : null}

        {children}
      </DialogContent>
    </Dialog>
  );
}