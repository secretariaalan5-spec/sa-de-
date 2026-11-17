import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-slate-900 group-[.toaster]:text-white group-[.toaster]:border-slate-800 group-[.toaster]:shadow-2xl group-[.toaster]:rounded-2xl p-4",
          description: "group-[.toast]:text-slate-300 text-xs mt-1 leading-relaxed",
          actionButton: "group-[.toast]:bg-slate-800 group-[.toast]:text-white group-[.toast]:hover:bg-slate-700 group-[.toast]:border group-[.toast]:border-slate-700 font-medium text-xs rounded-xl px-3 py-1.5",
          cancelButton: "group-[.toast]:bg-slate-800 group-[.toast]:text-slate-300",
          closeButton: "group-[.toast]:bg-slate-800 group-[.toast]:border-slate-700 group-[.toast]:text-slate-300 hover:group-[.toast]:text-white hover:group-[.toast]:bg-slate-700",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
