/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}',
    './node_modules/flowbite/**/*.js',
    './node_modules/flowbite-react/**/*.js'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // BaseOut Brand Colors using CSS custom properties
        'baseout-teal': {
          DEFAULT: 'rgb(45 90 90)',
          50: 'rgb(230 242 242)',
          100: 'rgb(204 229 229)',
          200: 'rgb(153 204 204)',
          300: 'rgb(102 178 178)',
          400: 'rgb(74 124 124)',
          500: 'rgb(45 90 90)',
          600: 'rgb(38 75 75)',
          700: 'rgb(31 60 60)',
          800: 'rgb(26 52 52)',
          900: 'rgb(19 42 42)'
        },
        'baseout-mountain': {
          DEFAULT: 'rgb(61 107 61)',
          50: 'rgb(232 245 232)',
          100: 'rgb(209 235 209)',
          200: 'rgb(163 215 163)',
          300: 'rgb(117 195 117)',
          400: 'rgb(79 159 79)',
          500: 'rgb(61 107 61)',
          600: 'rgb(51 87 51)',
          700: 'rgb(42 67 42)',
          800: 'rgb(33 48 33)',
          900: 'rgb(26 36 26)'
        },
        'baseout-blue': {
          DEFAULT: 'rgb(46 74 107)',
          50: 'rgb(231 235 240)',
          100: 'rgb(207 215 225)',
          200: 'rgb(159 175 195)',
          300: 'rgb(111 135 165)',
          400: 'rgb(78 104 135)',
          500: 'rgb(46 74 107)',
          600: 'rgb(38 62 89)',
          700: 'rgb(30 49 71)',
          800: 'rgb(23 37 53)',
          900: 'rgb(16 26 38)'
        },
        'baseout-orange': {
          DEFAULT: 'rgb(209 122 58)',
          50: 'rgb(251 242 232)',
          100: 'rgb(247 229 209)',
          200: 'rgb(239 203 163)',
          300: 'rgb(231 177 117)',
          400: 'rgb(220 149 86)',
          500: 'rgb(209 122 58)',
          600: 'rgb(184 99 47)',
          700: 'rgb(159 76 36)',
          800: 'rgb(134 53 25)',
          900: 'rgb(109 30 14)'
        },
        // Neutral Colors
        charcoal: {
          DEFAULT: 'rgb(44 62 80)',
          50: 'rgb(232 236 240)',
          100: 'rgb(209 217 225)',
          200: 'rgb(163 179 195)',
          300: 'rgb(117 141 165)',
          400: 'rgb(84 107 135)',
          500: 'rgb(44 62 80)',
          600: 'rgb(36 50 66)',
          700: 'rgb(28 38 52)',
          800: 'rgb(20 26 38)',
          900: 'rgb(12 14 24)'
        },
        slate: {
          DEFAULT: 'rgb(93 109 126)',
          50: 'rgb(239 241 243)',
          100: 'rgb(223 227 231)',
          200: 'rgb(191 199 207)',
          300: 'rgb(159 171 183)',
          400: 'rgb(126 140 159)',
          500: 'rgb(93 109 126)',
          600: 'rgb(74 87 104)',
          700: 'rgb(56 65 82)',
          800: 'rgb(37 43 60)',
          900: 'rgb(19 21 38)'
        },
        // Functional Colors
        success: '#27AE60',
        warning: '#F39C12',
        error: '#E74C3C',
        info: '#3498DB'
      },
      fontFamily: {
        'inter': ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        'outfit': ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        'code': ['Source Code Pro', 'SF Mono', 'Monaco', 'Consolas', 'monospace']
      },
      fontSize: {
        'display': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'h1': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'h2': ['1.75rem', { lineHeight: '1.25' }],
        'h3': ['1.375rem', { lineHeight: '1.3' }],
        'h4': ['1.125rem', { lineHeight: '1.35' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
        'body': ['1rem', { lineHeight: '1.5' }],
        'body-sm': ['0.875rem', { lineHeight: '1.4' }],
        'caption': ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.01em' }]
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
        '144': '36rem'
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem'
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'medium': '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'large': '0 10px 50px -12px rgba(0, 0, 0, 0.25)'
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        }
      }
    }
  },
  plugins: [
    require('flowbite/plugin')
  ]
}; 