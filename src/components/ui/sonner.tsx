import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg font-ui",
          description: "group-[.toast]:text-muted-foreground font-ui",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground font-ui",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground font-ui",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
