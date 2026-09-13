# Cabaña Booking Hub

Crea una aplicación web moderna y minimalista de reservas para una cabaña, optimizada para un prototipo rápido, con dos vistas principales (Cliente y Administrador):

**1. Vista de Cliente (Pública)**

* **Cabecera y Branding:** Mostrar el logotipo de la empresa y el nombre en la parte superior. Estilo visual inspirado en la siguiente paleta: tonos cálidos de madera, blancos y acentos naturales limpios (tipo rústico-moderno elegante).
* **Información Clave:** Se debe destacar claramente que el **Check-in es a las 16:00 hrs** y el **Check-out es a las 14:00 hrs**.
* **Calendario de Disponibilidad:** Un calendario interactivo donde el usuario pueda ver los días ocupados y seleccionar 1 o más días disponibles.
* **Cálculo de Precio:** El sistema debe calcular automáticamente el total multiplicando las noches seleccionadas por **$50.000 CLP por noche**.
* **Formulario de Reserva:** Al seleccionar los días, solicitar los siguientes campos obligatorios:
* Nombre y Apellido
* Número de teléfono
* Correo electrónico


* **Acción de Confirmación:** Al hacer clic en "Confirmar Reserva", debe simular o disparar:
* Un mensaje de WhatsApp automático dirigido al dueño con los detalles de la reserva.
* Un correo de confirmación enviado al cliente con copia al correo del administrador.



**2. Vista de Administrador (Privada)**

* **Pantalla de Inicio de Sesión:** Acceso exclusivo para el administrador con las credenciales fijas:
* **Correo:** benjaguti1015@gmail.com
* **Contraseña:** nacho1234


* **Panel de Control (Dashboard):**
* Un calendario/listado donde el administrador pueda ver todas las reservas agendadas.
* La capacidad de bloquear o habilitar días manualmente en el calendario.
* Ver el detalle de los clientes que reservaron (nombre, teléfono, correo y monto total).



**3. Requisitos Técnicos**

* Interfaz limpia, responsiva y componentes UI reutilizables (usar Tailwind CSS y Lucide Icons si aplica).
* Código modular y listo para compilar sin errores en una sola pasada para ahorrar tokens.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cabanamh.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a24b70cc-ce6e-4615-a5e9-4a386c3cec65).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
