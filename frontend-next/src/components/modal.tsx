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
}

export default function Modal({ title, description, open, onOpenChange, children, className }: ModalProps) {
    
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`overflow-y-auto max-h-[90vh] sm:max-w-max ${className}`}>
        {title || description &&<DialogHeader>
          {title && <DialogTitle>{title}</DialogTitle>}
          {description && <DialogDescription>
            {description}
          </DialogDescription>}
        </DialogHeader>}

         {children}
 
      </DialogContent>
    </Dialog>
  );
}