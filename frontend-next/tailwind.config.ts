import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: [
          "Poppins",
          "ui-sans-serif",
          "system-ui", 
          "-apple-system", 
          "BlinkMacSystemFont", 
          "'Segoe UI'", 
          "Roboto", 
          "'Helvetica Neue'", 
          "Arial", 
          "sans-serif"
        ],
        mono: [
          "ui-monospace", 
          "SFMono-Regular", 
          "Menlo", 
          "Monaco", 
          "Consolas", 
          "'Liberation Mono'", 
          "'Courier New'", 
          "monospace"
        ],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          50: "hsl(217 91% 95%)",
          100: "hsl(217 91% 90%)",
          200: "hsl(217 91% 80%)",
          300: "hsl(217 91% 70%)",
          400: "hsl(217 91% 60%)",
          500: "hsl(217 91% 50%)",
          600: "hsl(217 91% 40%)",
          700: "hsl(217 91% 30%)",
          800: "hsl(217 91% 20%)",
          900: "hsl(217 91% 10%)",
          950: "hsl(217 91% 5%)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          50: "hsl(142 76% 95%)",
          100: "hsl(142 76% 90%)",
          200: "hsl(142 76% 80%)",
          300: "hsl(142 76% 70%)",
          400: "hsl(142 76% 60%)",
          500: "hsl(142 76% 50%)",
          600: "hsl(142 76% 40%)",
          700: "hsl(142 76% 30%)",
          800: "hsl(142 76% 20%)",
          900: "hsl(142 76% 10%)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          50: "hsl(38 92% 95%)",
          100: "hsl(38 92% 90%)",
          200: "hsl(38 92% 80%)",
          300: "hsl(38 92% 70%)",
          400: "hsl(38 92% 60%)",
          500: "hsl(38 92% 50%)",
          600: "hsl(38 92% 40%)",
          700: "hsl(38 92% 30%)",
          800: "hsl(38 92% 20%)",
          900: "hsl(38 92% 10%)",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          50: "hsl(199 89% 95%)",
          100: "hsl(199 89% 90%)",
          200: "hsl(199 89% 80%)",
          300: "hsl(199 89% 70%)",
          400: "hsl(199 89% 60%)",
          500: "hsl(199 89% 48%)",
          600: "hsl(199 89% 40%)",
          700: "hsl(199 89% 30%)",
          800: "hsl(199 89% 20%)",
          900: "hsl(199 89% 10%)",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
        "128": "32rem",
        "144": "36rem",
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.75rem" }],
      },
      boxShadow: {
        "card": "var(--shadow-card)",
        "sm": "var(--shadow-sm)",
        "md": "var(--shadow-md)",
        "lg": "var(--shadow-lg)",
        "xl": "var(--shadow-xl)",
        "2xl": "var(--shadow-2xl)",
        "glass": "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
        "glow": "0 0 20px rgba(59, 130, 246, 0.5)",
        "glow-lg": "0 0 40px rgba(59, 130, 246, 0.3)",
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { 
            opacity: "0", 
            transform: "translateY(10px)" 
          },
          to: { 
            opacity: "1", 
            transform: "translateY(0)" 
          },
        },
        "fade-out": {
          from: { 
            opacity: "1", 
            transform: "translateY(0)" 
          },
          to: { 
            opacity: "0", 
            transform: "translateY(-10px)" 
          },
        },
        "slide-in-left": {
          from: { 
            opacity: "0", 
            transform: "translateX(-20px)" 
          },
          to: { 
            opacity: "1", 
            transform: "translateX(0)" 
          },
        },
        "slide-in-right": {
          from: { 
            opacity: "0", 
            transform: "translateX(20px)" 
          },
          to: { 
            opacity: "1", 
            transform: "translateX(0)" 
          },
        },
        "slide-up": {
          from: { 
            opacity: "0", 
            transform: "translateY(20px)" 
          },
          to: { 
            opacity: "1", 
            transform: "translateY(0)" 
          },
        },
        "slide-down": {
          from: { 
            opacity: "0", 
            transform: "translateY(-20px)" 
          },
          to: { 
            opacity: "1", 
            transform: "translateY(0)" 
          },
        },
        "scale-in": {
          from: { 
            opacity: "0", 
            transform: "scale(0.95)" 
          },
          to: { 
            opacity: "1", 
            transform: "scale(1)" 
          },
        },
        "scale-out": {
          from: { 
            opacity: "1", 
            transform: "scale(1)" 
          },
          to: { 
            opacity: "0", 
            transform: "scale(0.95)" 
          },
        },
        "bounce-in": {
          "0%": {
            opacity: "0",
            transform: "scale(0.3)",
          },
          "50%": {
            opacity: "1",
            transform: "scale(1.05)",
          },
          "70%": {
            transform: "scale(0.9)",
          },
          "100%": {
            opacity: "1",
            transform: "scale(1)",
          },
        },
        "shimmer": {
          "0%": {
            "background-position": "-200% 0"
          },
          "100%": {
            "background-position": "200% 0"
          }
        },
        "pulse-glow": {
          "0%, 100%": {
            opacity: "1",
            transform: "scale(1)",
          },
          "50%": {
            opacity: "0.8",
            transform: "scale(1.02)",
          },
        },
        "float": {
          "0%, 100%": {
            transform: "translateY(0px)",
          },
          "50%": {
            transform: "translateY(-5px)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out",
        "fade-out": "fade-out 0.3s ease-out",
        "slide-in-left": "slide-in-left 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
        "slide-down": "slide-down 0.4s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "scale-out": "scale-out 0.2s ease-out",
        "bounce-in": "bounce-in 0.6s ease-out",
        "shimmer": "shimmer 2s linear infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
        'colors': 'color, background-color, border-color, text-decoration-color, fill, stroke',
      },
      transitionDuration: {
        '0': '0ms',
        '2000': '2000ms',
      },
      transitionTimingFunction: {
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
      gridTemplateColumns: {
        'admin-layout': '4fr 8fr',
        'config-layout': '1fr 1fr',
        'auto-fit-250': 'repeat(auto-fit, minmax(250px, 1fr))',
        'auto-fit-300': 'repeat(auto-fit, minmax(300px, 1fr))',
      },
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
        'screen-2xl': '1536px',
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
  ],
} satisfies Config;