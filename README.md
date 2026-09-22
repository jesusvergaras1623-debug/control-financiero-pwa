# Control Financiero Mensual — PWA

Versión web instalable y adaptada a celular. No necesita Python ni Streamlit.

## Qué incluye
- Dashboard mensual con ingresos, gastos, pagos de deuda, disponible y deuda pendiente.
- Movimientos: ingresos, gastos y transferencias.
- Presupuesto mensual por categoría.
- Deudas: saldo, tasa, cuota, pagos y abonos extraordinarios.
- Cuentas: Bancolombia, Nequi, Nu, Sistecredito, Efectivo y otras.
- Configuración de categorías y cuentas.
- Respaldo JSON para exportar/importar los datos.
- Funcionamiento offline después de la primera carga (PWA).
- Diseño responsive para computador y celular.

## Uso local
En la carpeta, abre una terminal y ejecuta:

```bash
python -m http.server 8000
```

Luego abre `http://localhost:8000`.

Para instalarla como aplicación en el celular, súbela a un hosting HTTPS (GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc.) y usa "Añadir a pantalla de inicio" desde el navegador.

## Datos
La versión incluida guarda los datos en el navegador del dispositivo. Usa **Exportar respaldo** regularmente y conserva el archivo JSON. La función de importación restaura una copia en otro dispositivo.

## Publicación
Cualquier hosting estático que sirva HTTPS funciona. No necesita servidor Python. Para producción conviene usar un backend (por ejemplo Supabase/Firebase) si quieres sincronización automática entre dispositivos.