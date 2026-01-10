import React from "react";

const Card = React.forwardRef(function Card({ className = "", ...props }, ref) {
  return (
    <div
      ref={ref}
      className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}
      {...props}
    />
  );
});

const CardContent = React.forwardRef(function CardContent(
  { className = "", ...props },
  ref
) {
  return <div ref={ref} className={`p-6 ${className}`} {...props} />;
});

export { Card, CardContent };
