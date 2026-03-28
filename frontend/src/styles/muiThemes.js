import { createTheme } from "@mui/material/styles"

/*
 * 3-color rule (60-30-10):
 *   60% — background neutrals
 *   30% — surface / toolbar (earthy green family)
 *   10% — accent highlights (warm amber)
 *
 * Palette anchored to paleontology: deep greens, warm stone, fossil amber.
 */

const sharedTypography = {
  fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
  button: { fontWeight: 500 },
}

export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#8fbfa8", // sage green — readable on dark surfaces
    },
    secondary: {
      main: "#d4a84b", // warm amber accent (10 %)
    },
    background: {
      paper: "#0d0d0d",
      default: "#181818",
    },
    text: {
      primary: "#e8e6e3",
      secondary: "#9a9a9a",
    },
    action: {
      active: "#e8e6e3",
      hover: "rgba(255, 255, 255, 0.06)",
      selected: "rgba(255, 255, 255, 0.12)",
    },
  },
  typography: sharedTypography,
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#1e2b24", // dark green-tinted (30 %)
          color: "#e8e6e3",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          color: "#d5d3cf",
          "&:hover": {
            backgroundColor: "rgba(143, 191, 168, 0.10)",
          },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          margin: "2px 4px",
          transition: "background-color 0.15s ease",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#8fbfa8",
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
        },
      },
    },
  },
})

export const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#3b5249", // deep forest green (30 %)
    },
    secondary: {
      main: "#c9944a", // warm amber accent (10 %)
    },
    background: {
      paper: "#ffffff",
      default: "#f5f5f5",
    },
    text: {
      primary: "#1a1a1a",
      secondary: "#5f6b64", // green-tinted gray
    },
  },
  typography: sharedTypography,
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#3b5249", // earthy green (30 %)
          color: "#f0ede8",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          "&:hover": {
            backgroundColor: "rgba(59, 82, 73, 0.08)",
          },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          margin: "2px 4px",
          transition: "background-color 0.15s ease",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
        },
      },
    },
  },
})
