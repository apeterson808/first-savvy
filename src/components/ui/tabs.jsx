import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const TabsContext = React.createContext({ isFolderStyle: false })

const Tabs = React.forwardRef(({ className, children, ...props }, ref) => {
  const isFolderStyle = className?.includes('folder-tabs') ||
                        React.Children.toArray(children).some(
                          child => child?.props?.className?.includes('folder-tabs')
                        );

  return (
    <TabsContext.Provider value={{ isFolderStyle }}>
      <TabsPrimitive.Root ref={ref} className={className} {...props}>
        {children}
      </TabsPrimitive.Root>
    </TabsContext.Provider>
  );
})
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef(({ className, ...props }, ref) => {
  const { isFolderStyle } = React.useContext(TabsContext);
  const isThisFolderStyle = isFolderStyle || className?.includes('folder-tabs');

  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        isThisFolderStyle
          ? "flex h-auto items-end gap-0.5 bg-transparent border-b-0 mb-0"
          : "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        className
      )}
      {...props} />
  );
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => {
  const { isFolderStyle } = React.useContext(TabsContext);

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        isFolderStyle
          ? "relative inline-flex items-center justify-center whitespace-nowrap rounded-t-lg px-6 py-3 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=inactive]:bg-transparent data-[state=inactive]:text-slate-400 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:tab-folder-active"
          : "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
        className
      )}
      {...props} />
  );
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef(({ className, ...props }, ref) => {
  const { isFolderStyle } = React.useContext(TabsContext);

  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        isFolderStyle
          ? "bg-slate-100 rounded-b-lg rounded-tr-lg p-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          : "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props} />
  );
})
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
