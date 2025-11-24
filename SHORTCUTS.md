# PaleoDraw Shortcuts & Controls

This document provides a comprehensive reference for all keyboard shortcuts and mouse controls available in PaleoDraw.

## Keyboard Shortcuts

### Tools

| Key   | Action                                  |
| :---- | :-------------------------------------- |
| **T** | Activate **Select Tool**                |
| **C** | Activate **Curve Tool** (Spline)        |
| **L** | Activate **Line Tool** (Polyline)       |
| **N** | Activate **NURBS Tool** (Hybrid Spline) |
| **P** | Activate **Pan Tool**                   |
| **I** | **Import SVG** file                     |

### Project Operations

| Shortcut     | Action                           |
| :----------- | :------------------------------- |
| **Ctrl + N** | **New Project** (Clears canvas)  |
| **Ctrl + O** | **Open Project** (Load JSON)     |
| **Ctrl + S** | **Save Project** (Download JSON) |
| **Ctrl + E** | **Export as SVG**                |
| **Ctrl + Z** | **Undo**                         |
| **Ctrl + Y** | **Redo**                         |

### Selection & Editing

| Shortcut                   | Action                              | Scope     |
| :------------------------- | :---------------------------------- | :-------- |
| **Delete** / **Backspace** | Delete selected object(s) or points | Selection |
| **Ctrl + C**               | **Copy** selected object            | Selection |
| **Ctrl + X**               | **Cut** selected object             | Selection |
| **Ctrl + V**               | **Paste** object from clipboard     | Global    |
| **Escape**                 | Finish drawing / Cancel selection   | Global    |

### Movement & Nudge

| Shortcut              | Action                                   |
| :-------------------- | :--------------------------------------- |
| **Arrow Keys**        | Nudge selected object(s) by **10px**     |
| **Ctrl + Arrow Keys** | Fine nudge selected object(s) by **1px** |

### Layering (Z-Order)

| Shortcut             | Action                       |
| :------------------- | :--------------------------- |
| **Ctrl + F**         | **Bring Forward** (One step) |
| **Ctrl + Shift + F** | **Bring to Front** (Top)     |
| **Ctrl + B**         | **Send Backward** (One step) |
| **Ctrl + Shift + B** | **Send to Back** (Bottom)    |

---

## Mouse Controls

### General Canvas

| Action                      | Result                                     |
| :-------------------------- | :----------------------------------------- |
| **Wheel Scroll**            | **Zoom** In / Out                          |
| **Left Drag** (Select Tool) | **Pan** Canvas (if not clicking an object) |

### Select Tool

| Action                         | Result                                      |
| :----------------------------- | :------------------------------------------ |
| **Left Click**                 | Select object (Spline or SVG)               |
| **Left Drag** (on object)      | Move object                                 |
| **Right Drag** (on background) | **Box Selection** (Select multiple objects) |
| **Shift + Click**              | Add object to selection (Multi-select)      |

### Drawing Tools (Curve, Line, NURBS)

| Action                    | Result                                           |
| :------------------------ | :----------------------------------------------- |
| **Left Click**            | Add point to spline                              |
| **Double Click**          | Finish drawing current spline                    |
| **Shift + Click** (NURBS) | Add **Sharp Point** (Corner)                     |
| **Right Drag**            | **Point Box Selection** (Select multiple points) |

### Point Editing (Active Spline)

| Action                       | Result                                      |
| :--------------------------- | :------------------------------------------ |
| **Left Drag** (on point)     | Move point                                  |
| **Right Click** (on point)   | Delete point                                |
| **Shift + Click** (on point) | Add point to selection (Multi-point select) |
| **Double Click** (on point)  | Toggle point sharpness (NURBS only)         |
