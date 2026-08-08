const CONFIG = {
  modoPrueba: false,
  apiUrl: 'https://script.google.com/macros/s/AKfycbyNwLgHEFEpJBG8uFPdI7_t3HHy32mKwGBQ2nBNXOYCPZzpQdNNWdnfwZSucEQkjX0S/exec'
};

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const idInvitacion = Number(params.get('id'));
let datosActuales = null;

function tituloBonito(texto) {
  return String(texto || '')
    .toLowerCase()
    .replace(/(^|\s|[-–])\S/g, m => m.toUpperCase());
}

function mostrar(el) { el?.classList.remove('oculto'); }
function ocultar(el) { el?.classList.add('oculto'); }

$('abrirInvitacion')?.addEventListener('click', () => {
  document.body.classList.remove('portada-activa');
  $('portada').style.display = 'none';
  $('invitacion').setAttribute('aria-hidden', 'false');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

async function apiGet(action, extra = {}) {
  const q = new URLSearchParams({ action, ...extra });
  const respuesta = await fetch(`${CONFIG.apiUrl}?${q.toString()}`, {
    method: 'GET',
    cache: 'no-store'
  });

  if (!respuesta.ok) {
    throw new Error(`Error HTTP ${respuesta.status}`);
  }

  const data = await respuesta.json();

  if (data.exito === false) {
    throw new Error(data.mensaje || 'Ocurrió un error al consultar la invitación.');
  }

  return data;
}

async function apiPost(parametros) {
  const body = new URLSearchParams();

  Object.entries(parametros).forEach(([clave, valor]) => {
    body.append(clave, valor == null ? '' : String(valor));
  });

  const respuesta = await fetch(CONFIG.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    },
    body: body.toString()
  });

  if (!respuesta.ok) {
    throw new Error(`Error HTTP ${respuesta.status}`);
  }

  const data = await respuesta.json();

  if (data.exito === false) {
    throw new Error(data.mensaje || 'Ocurrió un error al guardar la información.');
  }

  return data;
}

async function cargarInvitacion() {
  if (!idInvitacion) {
    mostrarError('El enlace no contiene un ID de invitación válido.');
    return;
  }

  try {
    // IMPORTANTE: Apps Script espera action=invitacion
    const respuesta = await apiGet('invitacion', { id: idInvitacion });

    datosActuales = normalizarRespuesta(respuesta);

    renderInvitacion(datosActuales);
    renderMesas(datosActuales);
    renderFotos(datosActuales);
  } catch (error) {
    console.error(error);
    mostrarError(error.message || 'No se pudo cargar la invitación.');
  }
}

function normalizarRespuesta(respuesta) {
  const inv = respuesta.invitacion || {};

  const adultos = (respuesta.adultos || []).map(p => ({
    id: Number(p.idPersona),
    nombre: p.nombre,
    tipo: 'ADULTO',
    mesa: p.mesa,
    confirmacion: p.confirmacion || 'PENDIENTE'
  }));

  const ninos = (respuesta.ninos || []).map(p => ({
    id: Number(p.idNino),
    nombre: p.nombre,
    tipo: 'NIÑO',
    mesa: p.mesa,
    confirmacion: p.confirmacion || 'PENDIENTE'
  }));

  return {
    id: Number(inv.id),
    invitacion: inv.nombre || '',
    adultos: Number(inv.pasesAdultos || adultos.length || 0),
    ninos: Number(inv.pasesNinos || ninos.length || 0),
    invitados: adultos,
    ninosLista: ninos,
    estado: inv.estado || 'PENDIENTE',
    mostrarMesas: Boolean(respuesta.mesasDisponibles),
    fotosAbiertas: Boolean(respuesta.fotosDisponibles),
    fechaActual: respuesta.fechaActual || ''
  };
}

function renderInvitacion(data) {
  ocultar($('cargando'));
  mostrar($('contenido'));

  const nombre = tituloBonito(data.invitacion);

  $('nombreInvitado').textContent = nombre;
  $('saludoPortada').innerHTML = `Tenemos una invitación especial para<br><strong>${nombre}</strong>`;

  const adultos = Number(data.adultos || 0);
  const ninos = Number(data.ninos || 0);
  const total = adultos + ninos;

  $('pasesPermitidos').textContent = `${total} ${total === 1 ? 'lugar' : 'lugares'}`;

  $('resumenPases').innerHTML = [
    adultos ? `<span class="chip">${adultos} ${adultos === 1 ? 'adulto' : 'adultos'}</span>` : '',
    ninos ? `<span class="chip">${ninos} ${ninos === 1 ? 'niño' : 'niños'}</span>` : ''
  ].join('');

  const lista = $('listaPersonas');
  lista.innerHTML = '';

  if (data.invitados.length) {
    lista.innerHTML += '<p class="grupo-titulo">Adultos</p>' +
      data.invitados.map(p => checkboxPersona(p, 'adulto')).join('');
  }

  if (data.ninosLista.length) {
    lista.innerHTML += '<p class="grupo-titulo">Niños</p>' +
      data.ninosLista.map(p => checkboxPersona(p, 'nino')).join('');
  }
}

function checkboxPersona(persona, origen) {
  const estado = String(persona.confirmacion || '').toUpperCase();

  // Primera vez (PENDIENTE): aparece marcado por comodidad.
  // Si ya dijo NO ASISTE: aparece desmarcado.
  const checked = estado === 'NO ASISTE' ? '' : 'checked';

  return `
    <label class="persona-check">
      <input
        type="checkbox"
        class="persona"
        data-origen="${origen}"
        value="${persona.id}"
        ${checked}
      >
      <span>${tituloBonito(persona.nombre)}</span>
    </label>`;
}

$('nadieAsiste')?.addEventListener('change', (e) => {
  document.querySelectorAll('.persona').forEach(input => {
    input.checked = !e.target.checked;
    input.disabled = e.target.checked;
  });
});

$('formConfirmacion')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nadie = $('nadieAsiste').checked;
  const comentario = $('comentario').value.trim();

  const adultos = nadie
    ? []
    : [...document.querySelectorAll('.persona[data-origen="adulto"]:checked')]
        .map(x => Number(x.value));

  const ninos = nadie
    ? []
    : [...document.querySelectorAll('.persona[data-origen="nino"]:checked')]
        .map(x => Number(x.value));

  if (!nadie && adultos.length + ninos.length === 0) {
    $('mensajeFormulario').textContent =
      'Selecciona quiénes asistirán o marca que nadie podrá acompañarnos.';
    return;
  }

  $('mensajeFormulario').textContent = 'Guardando confirmación...';
  $('botonConfirmar').disabled = true;

  try {
    const respuesta = await apiPost({
      action: 'confirmar',
      id: idInvitacion,
      adultos: adultos.join(','),
      ninos: ninos.join(','),
      comentario
    });

    ocultar($('contenido'));
    mostrar($('exito'));

    const total = adultos.length + ninos.length;

    $('mensajeExito').textContent = nadie
      ? 'Registramos que en esta ocasión no podrán acompañarnos. Gracias por avisarnos.'
      : `Registramos la asistencia de ${total} persona${total === 1 ? '' : 's'}.`;

    console.log(respuesta);
  } catch (error) {
    console.error(error);
    $('mensajeFormulario').textContent = error.message;
    $('botonConfirmar').disabled = false;
  }
});

function renderMesas(data) {
  if (!data.mostrarMesas) {
    $('mesaEstado').textContent =
      'La asignación de mesas estará disponible a partir del 9 de octubre de 2026.';
    ocultar($('listaMesas'));
    return;
  }

  const personas = [...data.invitados, ...data.ninosLista]
    .filter(p => String(p.confirmacion || '').toUpperCase() === 'CONFIRMADO');

  if (!personas.length) {
    $('mesaEstado').textContent =
      'Cuando confirmes tu asistencia aparecerá aquí la información de tu mesa.';
    ocultar($('listaMesas'));
    return;
  }

  $('mesaEstado').textContent = 'Estas son sus mesas asignadas:';

  $('listaMesas').innerHTML = personas.map(p => {
    const esNino = String(p.tipo).toUpperCase() === 'NIÑO';
    const mesa = esNino ? 'Mesa de niños' : `Mesa ${p.mesa || 'por asignar'}`;

    return `
      <div class="mesa-persona">
        <span>${tituloBonito(p.nombre)}</span>
        <strong>${mesa}</strong>
      </div>`;
  }).join('');

  mostrar($('listaMesas'));
}

function renderFotos(data) {
  const abierta = Boolean(data.fotosAbiertas);

  $('textoFotos').textContent = abierta
    ? 'La galería está abierta. Puedes compartir fotos y recuerdos de la celebración.'
    : 'La carga de fotografías estará disponible únicamente el 10 y 11 de octubre de 2026.';

  $('inputFotos').disabled = !abierta;
  $('botonFotos').disabled = !abierta;
  $('botonFotos').textContent = abierta
    ? 'Subir fotos'
    : 'Disponible 10 y 11 de octubre';
}

$('formFotos')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!datosActuales?.fotosAbiertas) return;

  const archivos = [...$('inputFotos').files];

  if (!archivos.length) {
    $('mensajeFotos').textContent = 'Selecciona al menos una foto.';
    return;
  }

  if (archivos.length > 5) {
    $('mensajeFotos').textContent = 'Puedes subir hasta 5 fotos por envío.';
    return;
  }

  $('botonFotos').disabled = true;
  $('mensajeFotos').textContent = 'Subiendo fotos...';

  try {
    for (const archivo of archivos) {
      if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(archivo.type || 'image/jpeg')) {
        throw new Error(`Formato no permitido: ${archivo.name}`);
      }

      if (archivo.size > 8 * 1024 * 1024) {
        throw new Error(`${archivo.name} pesa más de 8 MB.`);
      }

      const base64 = await archivoABase64(archivo);

      await apiPost({
        action: 'subirFoto',
        id: idInvitacion,
        nombreArchivo: archivo.name,
        tipoMime: archivo.type || 'image/jpeg',
        archivo: base64
      });
    }

    $('mensajeFotos').textContent = '¡Gracias! Tus fotos se guardaron correctamente.';
    $('inputFotos').value = '';
  } catch (error) {
    console.error(error);
    $('mensajeFotos').textContent = error.message;
  } finally {
    $('botonFotos').disabled = !datosActuales?.fotosAbiertas;
  }
});

function archivoABase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const resultado = String(reader.result || '');
      const coma = resultado.indexOf(',');
      resolve(coma >= 0 ? resultado.slice(coma + 1) : resultado);
    };

    reader.onerror = () => reject(new Error('No se pudo leer la fotografía.'));
    reader.readAsDataURL(file);
  });
}

function mostrarError(mensaje) {
  ocultar($('cargando'));
  ocultar($('contenido'));
  mostrar($('errorGeneral'));
  $('mensajeErrorGeneral').textContent = mensaje;
}

const fechaEvento = new Date('2026-10-10T18:00:00-06:00');

function actualizarContador() {
  const diferencia = Math.max(0, fechaEvento - Date.now());

  $('dias').textContent = Math.floor(diferencia / 86400000);
  $('horas').textContent = Math.floor((diferencia % 86400000) / 3600000);
  $('minutos').textContent = Math.floor((diferencia % 3600000) / 60000);
  $('segundos').textContent = Math.floor((diferencia % 60000) / 1000);
}

actualizarContador();
setInterval(actualizarContador, 1000);
cargarInvitacion();
