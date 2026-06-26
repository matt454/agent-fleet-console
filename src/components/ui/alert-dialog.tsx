"use client"

import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"

import { cn } from "../../lib/utils.ts"
import { Button } from "./button.tsx"

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal
      data-slot="alert-dialog-portal"
      {...props}
    />
  )
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn("ui-alert-dialog-overlay", className)}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn("ui-alert-dialog-content", className)}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div data-slot="alert-dialog-header" className={cn("ui-alert-dialog-header", className)} {...props} />
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div data-slot="alert-dialog-footer" className={cn("ui-alert-dialog-footer", className)} {...props} />
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("ui-alert-dialog-title", className)}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("ui-alert-dialog-description", className)}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  children = "Continue",
  variant = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> & { variant?: "default" | "outline" | "destructive" | "ghost" }) {
  return (
    <AlertDialogPrimitive.Action asChild {...props}>
      <Button variant={variant} className={className}>{children}</Button>
    </AlertDialogPrimitive.Action>
  )
}

function AlertDialogCancel({
  className,
  children = "Cancel",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel asChild {...props}>
      <Button variant="outline" className={className}>{children}</Button>
    </AlertDialogPrimitive.Cancel>
  )
}

export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
