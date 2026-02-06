/** @type {import('tailwindcss').Config} — тип конфигурации Tailwind */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ═══════════════════════════════════════
      // ЦВЕТА — привязка к design tokens
      // ═══════════════════════════════════════
      colors: {
        // Слои фона
        app: 'var(--bg-app)',
        surface: {
          DEFAULT: 'var(--bg-surface)',
          raised: 'var(--bg-surface-raised)',
          overlay: 'var(--bg-surface-overlay)',
          hover: 'var(--bg-surface-hover)',
          active: 'var(--bg-surface-active)',
        },
        input: 'var(--bg-input)',
        code: 'var(--bg-code)',
        subtle: 'var(--bg-subtle)',

        // Иерархия текста
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          subtle: 'var(--text-subtle)',
          disabled: 'var(--text-disabled)',
          placeholder: 'var(--text-placeholder)',
        },

        // Фирменный цвет (красный)
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          active: 'var(--primary-active)',
          deep: 'var(--primary-deep)',
          shadow: 'var(--primary-shadow)',
          // Прозрачные варианты
          subtle: 'var(--primary-subtle)',
          muted: 'var(--primary-muted)',
          light: 'var(--primary-light)',
          medium: 'var(--primary-medium)',
          strong: 'var(--primary-strong)',
          intense: 'var(--primary-intense)',
        },

        // Семантические цвета
        success: {
          DEFAULT: 'var(--success)',
          muted: 'var(--success-muted)',
          subtle: 'var(--success-subtle)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          hover: 'var(--danger-hover)',
          muted: 'var(--danger-muted)',
          subtle: 'var(--danger-subtle)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          muted: 'var(--warning-muted)',
        },
        info: {
          DEFAULT: 'var(--info)',
          muted: 'var(--info-muted)',
        },

        // Эффекты стекла
        glass: {
          subtle: 'var(--glass-subtle)',
          light: 'var(--glass-light)',
          medium: 'var(--glass-medium)',
          strong: 'var(--glass-strong)',
          intense: 'var(--glass-intense)',
        },
      },

      // ═══════════════════════════════════════
      // ЦВЕТА ГРАНИЦ
      // ═══════════════════════════════════════
      borderColor: {
        DEFAULT: 'var(--border-default)',
        subtle: 'var(--border-subtle)',
        strong: 'var(--border-strong)',
        emphasis: 'var(--border-emphasis)',
        primary: {
          DEFAULT: 'var(--border-primary)',
          muted: 'var(--border-primary-muted)',
        },
        danger: 'var(--border-danger)',
        success: 'var(--border-success)',
      },

      // ═══════════════════════════════════════
      // ТЕНИ
      // ═══════════════════════════════════════
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'DEFAULT': 'var(--shadow-md)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
        'primary': 'var(--shadow-primary)',
        'primary-lg': 'var(--shadow-primary-lg)',
        'primary-xl': 'var(--shadow-primary-xl)',
        'inner': 'var(--shadow-inner)',
        'inner-strong': 'var(--shadow-inner-strong)',
      },

      // ═══════════════════════════════════════
      // СКРУГЛЕНИЯ
      // ═══════════════════════════════════════
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'DEFAULT': 'var(--radius-md)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        'full': 'var(--radius-full)',
      },

      // ═══════════════════════════════════════
      // ОТСТУПЫ (используем стандартные + кастомные)
      // ═══════════════════════════════════════
      spacing: {
        'xs': 'var(--spacing-xs)',
        'sm': 'var(--spacing-sm)',
        'md': 'var(--spacing-md)',
        'lg': 'var(--spacing-lg)',
        'xl': 'var(--spacing-xl)',
        '2xl': 'var(--spacing-2xl)',
        '3xl': 'var(--spacing-3xl)',
        '4xl': 'var(--spacing-4xl)',
        '5xl': 'var(--spacing-5xl)',
      },

      // ═══════════════════════════════════════
      // ПЕРЕХОДЫ
      // ═══════════════════════════════════════
      transitionDuration: {
        'fast': '150ms',
        'base': '250ms',
        'slow': '350ms',
      },
      transitionTimingFunction: {
        'in-out': 'var(--ease-in-out)',
        'out': 'var(--ease-out)',
        'in': 'var(--ease-in)',
      },

      // ═══════════════════════════════════════
      // Z-ИНДЕКС
      // ═══════════════════════════════════════
      zIndex: {
        'base': 'var(--z-base)',
        'dropdown': 'var(--z-dropdown)',
        'sticky': 'var(--z-sticky)',
        'fixed': 'var(--z-fixed)',
        'modal-backdrop': 'var(--z-modal-backdrop)',
        'modal': 'var(--z-modal)',
        'popover': 'var(--z-popover)',
        'tooltip': 'var(--z-tooltip)',
        'toast': 'var(--z-toast)',
      },

      // ═══════════════════════════════════════
      // ТИПОГРАФИКА
      // ═══════════════════════════════════════
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      fontSize: {
        'xs': ['var(--font-size-xs)', { lineHeight: 'var(--line-height-normal)' }],
        'sm': ['var(--font-size-sm)', { lineHeight: 'var(--line-height-normal)' }],
        'base': ['var(--font-size-base)', { lineHeight: 'var(--line-height-normal)' }],
        'lg': ['var(--font-size-lg)', { lineHeight: 'var(--line-height-normal)' }],
        'xl': ['var(--font-size-xl)', { lineHeight: 'var(--line-height-tight)' }],
        '2xl': ['var(--font-size-2xl)', { lineHeight: 'var(--line-height-tight)' }],
        '3xl': ['var(--font-size-3xl)', { lineHeight: 'var(--line-height-tight)' }],
        '4xl': ['var(--font-size-4xl)', { lineHeight: 'var(--line-height-tight)' }],
      },
      fontWeight: {
        normal: 'var(--font-weight-normal)',
        medium: 'var(--font-weight-medium)',
        semibold: 'var(--font-weight-semibold)',
        bold: 'var(--font-weight-bold)',
      },

      // ═══════════════════════════════════════
      // РАЗМЫТИЕ ФОНА
      // ═══════════════════════════════════════
      backdropBlur: {
        DEFAULT: '16px',
        'lg': '24px',
      },

      // ═══════════════════════════════════════
      // КОНТУРЫ ФОКУСА (RING)
      // ═══════════════════════════════════════
      ringColor: {
        DEFAULT: 'var(--ring-default)',
        primary: 'var(--ring-primary)',
      },
      ringWidth: {
        DEFAULT: '2px',
      },
      ringOffsetWidth: {
        DEFAULT: '1px',
      },
      ringOffsetColor: {
        DEFAULT: 'var(--bg-surface)',
      },
    },
  },
  plugins: [],
}
