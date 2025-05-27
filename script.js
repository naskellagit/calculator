const sheetId = '1uyONkzWrBBsq1QTk1IYNbAqEekxNlQsFbKrDDWQAMM0' // id таблицы google из url
const tokenForDaData = '201f081fe6854e687c45aa8ad979c2334c94fd85'
const tokenForOpenRouteService = '5b3ce3597851110001cf6248642382220b344342b54d1eae75bc69fa'
const urlApiDaData = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address'
const urlApiOpenRouteService = 'https://api.openrouteservice.org/v2/matrix/driving-car'
let inputTipesOfGarbage = []
let poligonsForGarbage = []
let addresses = []
let currentAddress = {}
let tabData = []

// Это для того чтобы стразу можно было нажать расчитать - для работы с версткой)))

// document.querySelectorAll('input').forEach(input => {
//   input.removeAttribute('required')
// })

let checkedPoligonAddress = ''

const input = document.getElementById('wasteInput') // выбор типа мусора
const suggestionsBox = document.getElementById('suggestions') // подсказки для типа мусора
const inputAddress = document.getElementById("address") // выбор адреса
const suggestionsAddressContainer = document.getElementById("suggestionsAddress") // подсказки для адреса
const isUtilization = document.getElementById('checkbox-utilization')

const resultBlock = document.querySelector('.result-block')
const tabsContainer = document.getElementById("tabsContainer")
const contentsContainer = document.getElementById("contentsContainer")

const calculateForm = document.querySelector('.form-group')
calculateForm.addEventListener('submit', calculateButtonHandler)

const contactForm = document.querySelector('.contact-block__container')
contactForm.addEventListener('submit', function(e){
  e.preventDefault()
  const clientName = this.customerName.value
  const clientPhone = this.customerPhone.value
  const isConfirm = this.isConfirm.checked
  if(!isConfirm){
    alert('Пожалуйста, подтвердите согласие перед отправкой!')
    return
  }
  console.log('Клиент - ', clientName)
  console.log('Телефон - ', clientPhone)
  console.log('Адрес вывоза - ', currentAddress.fullAddress)
  console.log('Адрес полигона - ', checkedPoligonAddress)
})

function addMore() {
  const container = document.querySelector('.added-form-group-block')
  const firstBlock = container.querySelector('.added-block')
  const newBlock = firstBlock.cloneNode(true) // Копируем блок
  newBlock.querySelectorAll('input').forEach((input, idx) => {
    input.value = ''
    if(input.id === 'wasteInput'){
      const suggestionsBox = newBlock.querySelector('#suggestions')
      inputGarbageAddEvent(input, suggestionsBox)
    }
  })
  const removeRowButton = newBlock.querySelector('.close-added-item-block')
  removeRowButton.style.visibility = 'visible'
  removeRowButton.addEventListener('click', () => {
    newBlock.remove()
    drawLines()
  })
  container.appendChild(newBlock) // Добавляем на страницу
  drawLines()
}

async function requestDistantsToPoligons(poligons){
  const clientLocation = [+currentAddress.lon, +currentAddress.lat]
  const poligonLocations = poligons.map(poligon => [+poligon.coordinates.lon, +poligon.coordinates.lat])
  const locations = [clientLocation, ...poligonLocations]

  const body = {
    locations,
    sources: [0], // только клиент — это первая точка
    destinations: poligonLocations.map((_, i) => i + 1), // индексы всех полигонов
    metrics: ['distance', 'duration']
  }
  const response = await fetch(urlApiOpenRouteService, {
    method: 'POST',
    headers: {
      'Authorization': tokenForOpenRouteService,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const data = await response.json()

  const newPoligons = poligons.map((el, index) => ({
    name: el.name,
    address: el.address,
    distance: Math.round(data.distances[0][index] / 1000)
  }))
  return newPoligons
}

async function calculateButtonHandler(e){
  e.preventDefault()
  resultBlock.style.display = 'block'
  // Раскомеентировать нижние 2 строки для верстки, а именно tabsInit() и return
  // tabsInit()
  scrollToResultBlock()
  // return
  tabsCloseButtonHandler()
  const blocks = document.querySelectorAll('.added-block')
  const garbageArr = []
  let poligonsForRequest = []
  for(let i = 0; i < blocks.length; i++){
    const garbage = blocks[i].querySelector('#wasteInput')
    const volume = blocks[i].querySelector('#volume')
    const unit = blocks[i].querySelector('#unit')
    const poligonsForGarbageType = poligonsForGarbage.filter(el => el.typeOfGarbageForPoligon.some(item => item.name === garbage.value))
    poligonsForRequest = poligonsForRequest.concat(poligonsForGarbageType.filter(el => !poligonsForRequest.some(item => item.address === el.address)))
    const addedElemrnt = {
      'Адрес вывоза': currentAddress,
      'Тип мусора': garbage.value,
      'Объем': volume.value,
      'Единица измерения': unit.value,
      'Утилизация': isUtilization.checked,
      poligons: poligonsForGarbageType
    }
    garbageArr.push(addedElemrnt)
  }
  const newPoligons = await requestDistantsToPoligons(poligonsForRequest)
  garbageArr.forEach(elem => {
    tabData.push({
      id: elem['Тип мусора'],
      title: elem['Тип мусора'],
      tableData: elem.poligons.map(poligon => {
        const findedDistance = newPoligons.find(el => el.address === poligon.address).distance
        const typeOfGarbage = poligon.typeOfGarbageForPoligon.find(el => el.name === elem['Тип мусора'])
        const unit = elem['Единица измерения']
        const pricePerUnit = unit === 'ton' ? typeOfGarbage.tonPrice : typeOfGarbage.cubicPrice
        const pricePerUtilization = elem['Утилизация'] ? parseInt(poligon.priceForDisposal) : 0
        const price = findedDistance * elem['Объем'] * pricePerUnit + pricePerUtilization
        return {
          col1: {title: poligon.name, value: poligon.address},
          col2: {title: findedDistance + ' км', value: ''},
          col3: {title: price + ' ₽', value: ''}
        }
      })
    })
  })
  tabsInit()
}

async function loadData(){
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`

  try {
    const response = await fetch(url)
    const text = await response.text()
    const json = JSON.parse(text.substring(47).slice(0, -2)) // убираем обёртку Google
    const rows = json.table.rows

    const typeOfGarbage = []
    const poligons = []
    const SLICES_INDEXES = 5
    const garbageArr = rows[0].c.slice(SLICES_INDEXES)

    for(let i = 0; i < garbageArr.length; i++){
      if(garbageArr[i]){
        const pushElement = {
          name: garbageArr[i].v,
          cubicPrice: parseInt(rows[1].c[SLICES_INDEXES + i].v),
          tonPrice: parseInt(rows[2].c[SLICES_INDEXES + i].v)
        }
        typeOfGarbage.push(pushElement)
      }
      else break
    }

    const poligonArr = rows.slice(3)

    poligonArr.forEach(poligon => {
      const typeOfGarbageLength = typeOfGarbage.length
      const typeOfGarbageForPoligon = []
      const availabilityArr = poligon.c.slice(SLICES_INDEXES)
      for(let i = 0; i < typeOfGarbageLength; i++){
        if(availabilityArr[i] && availabilityArr[i].v){
          typeOfGarbageForPoligon.push(typeOfGarbage[i])
        }
      }
      const pushedElement = {
        name: poligon.c[0].v,
        address: poligon.c[1].v,
        coordinates: {
          lat: poligon.c[2].v.split(' ')[0],
          lon: poligon.c[2].v.split(' ')[1]
        },
        priceForDisposal: poligon.c[3] ? poligon.c[3].v : 0,
        typeOfGarbageForPoligon
      }
      poligons.push(pushedElement)
    })
    inputTipesOfGarbage = typeOfGarbage
    poligonsForGarbage = poligons
    
  } catch (err) {
    console.error('Ошибка при загрузке данных:', err)
  }
}

loadData()

function inputGarbageAddEvent (inputItem, suggestionsBoxItem){
  inputItem.addEventListener('click', () => {
    const matches = inputTipesOfGarbage.map(el => el.name)
    suggestionsBoxItem.innerHTML = ''
    suggestionsBoxItem.style.display = 'block'
    matches.forEach(match => {
      const div = document.createElement('div')
      div.textContent = match
      div.style.padding = '5px'
      div.style.cursor = 'pointer'

      div.addEventListener('click', () => {
        inputItem.value = match
        suggestionsBoxItem.style.display = 'none'
      })

      suggestionsBoxItem.appendChild(div)
    })
  })
  inputItem.addEventListener('input', () => {
    const query = inputItem.value.toLowerCase()
    const matchesObject = inputTipesOfGarbage.filter(type => type.name.toLowerCase().includes(query))
    const matches = matchesObject.map(el => el.name)
      
    // Очистка
    suggestionsBoxItem.innerHTML = ''
      
    if (query && matches.length) {
      suggestionsBoxItem.style.display = 'block'
      matches.forEach(match => {
        const div = document.createElement('div')
        div.textContent = match
        div.style.padding = '5px'
        div.style.cursor = 'pointer'
  
        div.addEventListener('click', () => {
          inputItem.value = match
          suggestionsBoxItem.style.display = 'none'
        })
  
        suggestionsBoxItem.appendChild(div)
      })
    } else {
      suggestionsBoxItem.style.display = 'none'
    }
  })
  // Скрытие при клике вне
  document.addEventListener('click', (e) => {
    if (!suggestionsBoxItem.contains(e.target) && e.target !== inputItem) {
      suggestionsBoxItem.style.display = 'none'
      if(!inputTipesOfGarbage.some(el => el.name === inputItem.value)){
        inputItem.value = ''
      }
    }
  })
}

function inputAddressAddEvent(inputItem, suggestionsContainer){

  inputItem.addEventListener('input', async() => {

    const query = inputItem.value.trim()

    // Удаляем старые подсказки
    suggestionsContainer.innerHTML = ''

    if(query.length < 3) return

    const response = await fetch(urlApiDaData, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: 'Token ' + tokenForDaData
      },
      body: JSON.stringify({
        query,
        locations: [
          { kladr_id: "77" }, // Москва
          { kladr_id: "50" }  // Московская область
        ]
      })
    })
    const data = await response.json()
    addresses = (data.suggestions || []).filter(item => item.data.geo_lat && item.data.geo_lon)
    suggestionsContainer.style.display = 'block'

    addresses.forEach(item => {
      const div = document.createElement('div')
      div.classList.add('suggestion-item')
      div.textContent = item.value

      div.addEventListener('click', () => {
        inputItem.value = item.value
        suggestionsContainer.innerHTML = '' // скрыть подсказки
        suggestionsContainer.style.display = 'none'
        currentAddress = {
          fullAddress: item.value,
          lat: item.data.geo_lat,
          lon: item.data.geo_lon
        }
      })

      suggestionsContainer.appendChild(div)
    })
  })

  document.addEventListener('click', (e) => {
    if(!inputItem.contains(e.target) && !suggestionsContainer.contains(e.target)) {
      suggestionsContainer.innerHTML = ''
      suggestionsContainer.style.display = 'none'
      if(!addresses.some(el => el.value === inputItem.value)){
        inputItem.value = ''
      }
    }
  })
}

function tabsInit(){
  tabData.forEach((tab, index) => {
    // Таб
    const tabElement = document.createElement("div")
    tabElement.classList.add("tab")
    if (index === 0) tabElement.classList.add("active")
    tabElement.setAttribute("data-tab", tab.id)
    tabElement.textContent = tab.title
    tabsContainer.appendChild(tabElement)
  
    // Таблица с данными
    const tableElement = document.createElement("div")
    tableElement.classList.add("tab-table")
  
    // Данные таблицы
    tab.tableData.forEach((rowData) => {
      const row = document.createElement("div")
      row.classList.add('result-table-row')
      Object.values(rowData).forEach((cellData, idx) => {
        const td = document.createElement("div")
        if(!idx){
          row.setAttribute("data-address", cellData.value)
          td.innerHTML = `<div class="tab-lable-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clip-path="url(#clip0_25_59)">
                <path d="M10 13.75C13.1066 13.75 15.625 11.2316 15.625 8.125C15.625 5.0184 13.1066 2.5 10 2.5C6.8934 2.5 4.375 5.0184 4.375 8.125C4.375 11.2316 6.8934 13.75 10 13.75Z" stroke="#9C9C9C" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M10 13.75V18.125" stroke="#9C9C9C" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
              </g>
              <defs>
                <clipPath id="clip0_25_59">
                  <rect width="20" height="20" fill="white"/>
                </clipPath>
              </defs>
            </svg>
          </div>`
          const container = document.createElement("div")
          container.classList.add('address-text-block')
          const h4 = document.createElement("h4")
          h4.textContent = cellData.title
          container.appendChild(h4)
          const span = document.createElement("span")
          span.textContent = cellData.value
          container.appendChild(span)
          td.appendChild(container)
        } else {
          const h4 = document.createElement("h4")
          h4.textContent = cellData.title
          td.appendChild(h4)
        }
        row.appendChild(td)
      })
      row.addEventListener('click', () => {
        checkedPoligonAddress = row.getAttribute('data-address')
      })
      tableElement.appendChild(row)
    })
  
    // Контент для таба
    const contentElement = document.createElement("div")
    contentElement.classList.add("tab-content")
    if (index === 0) contentElement.classList.add("active")
    contentElement.id = tab.id
    contentElement.appendChild(tableElement)
    contentsContainer.appendChild(contentElement)
  })
  
  // Навешиваем обработчики для табов
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Убираем активные классы
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'))
  
      // Активируем выбранный таб
      tab.classList.add('active')
      const targetId = tab.getAttribute('data-tab')
      document.getElementById(targetId).classList.add('active')
    })
  })
}

function tabsCloseButtonHandler(){
  tabData = []
  tabsContainer.innerHTML = ''
  contentsContainer.innerHTML = ''
}

function scrollToResultBlock() {
  const blockTop = document.querySelector('.result-block').getBoundingClientRect().top + window.scrollY
  window.scrollTo({
    top: blockTop,
    behavior: 'smooth'
  })
}

inputGarbageAddEvent(input, suggestionsBox)
inputAddressAddEvent(inputAddress, suggestionsAddressContainer)


// Для отрисовки линий svg
let counter = 1

function getRightCenter(el) {
  const rect = el.getBoundingClientRect()
  return {
    x: rect.right,
    y: rect.top + rect.height / 2,
  }
}

function getLeftCenter(el) {
  const rect = el.getBoundingClientRect()
  return {
    x: rect.left,
    y: rect.top + rect.height / 2,
  }
}

function drawLines() {
  if (window.innerWidth <= 768) return
  const svg = document.getElementById("svgLines")
  const left = getRightCenter(document.querySelector(".left-block-for-svg-lines"))
  const rights = document.querySelectorAll(".right-blocks-for-svg-lines")

  const svgRect = svg.getBoundingClientRect()

  const defs = `
    <defs>
      <marker id="diamond" markerWidth="4" markerHeight="4" refX="2" refY="2"
        orient="auto" markerUnits="strokeWidth">
        <path d="M2 0 L4 2 L2 4 L0 2 Z" fill="#D7D7D9" />
      </marker>
    </defs>
  `

  const paths = Array.from(rights).map((el) => {
    const right = getLeftCenter(el)

    const x1 = left.x - svgRect.left
    const y1 = left.y - svgRect.top
    const x2 = right.x - svgRect.left
    const y2 = right.y - svgRect.top

    const cx = (x1 + x2) / 2

    return `<path d="M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}"
      stroke="#D7D7D9" fill="none" stroke-width="2"
      marker-start="url(#diamond)" marker-end="url(#diamond)"/>`
  })

  svg.innerHTML = defs + paths.join("")
}

window.addEventListener("load", drawLines)
window.addEventListener("resize", drawLines)

// tabsInit()
