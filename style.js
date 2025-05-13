const tokenForDaData = '201f081fe6854e687c45aa8ad979c2334c94fd85'
const tokenForOpenRouteService = '5b3ce3597851110001cf6248642382220b344342b54d1eae75bc69fa'
const urlApiDaData = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address'
const urlApiOpenRouteService = 'https://api.openrouteservice.org/v2/matrix/driving-car'
let inputTipesOfGarbage = []
let poligonsForGarbage = []
let addresses = []
let currentAddress = {}
let tabData = []

const input = document.getElementById('wasteInput') // выбор типа мусора
const suggestionsBox = document.getElementById('suggestions') // подсказки для типа мусора
const inputAddress = document.getElementById("address") // выбор адреса
const suggestionsAddressContainer = document.getElementById("suggestionsAddress") // подсказки для адреса
const isUtilization = document.getElementById('checkbox-utilization')

const tabsContainer = document.getElementById("tabsContainer")
const contentsContainer = document.getElementById("contentsContainer")
const closeButton = document.querySelector('.close-result-button')

// tabData = [
//   {
//     id: "1",
//     title: "Тип мусора 5",
//     tableData: [
//       { col1: "Ячейка 1-1", col2: "Ячейка 1-2", col3: "Ячейка 1-3" },
//       { col1: "Ячейка 2-1", col2: "Ячейка 2-2", col3: "Ячейка 2-3" },
//     ]
//   },
//   {
//     id: "tab2",
//     title: "Таб 2",
//     tableData: [
//       { col1: "Ячейка A-1", col2: "Ячейка A-2", col3: "Ячейка A-3" },
//       { col1: "Ячейка B-1", col2: "Ячейка B-2", col3: "Ячейка B-3" },
//       { col1: "Ячейка C-1", col2: "Ячейка C-2", col3: "Ячейка C-3" },
//     ]
//   },
//   {
//     id: "tab3",
//     title: "Таб 3",
//     tableData: [
//       { col1: "Ячейка X-1", col2: "Ячейка X-2", col3: "Ячейка X-3" },
//     ]
//   },
//   {
//     id: "tab4",
//     title: "Таб 4",
//     tableData: [
//       { col1: "Ячейка X-1", col2: "Ячейка X-2", col3: "Ячейка X-3" },
//     ]
//   }
// ]

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
  }) // Очищаем поля
  container.appendChild(newBlock); // Добавляем на страницу
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
  console.log('данные сервера', data)

  const newPoligons = poligons.map((el, index) => ({
    name: el.name,
    address: el.address,
    distance: Math.round(data.distances[0][index] / 1000)
  }))
  return newPoligons
}

async function calculateButtonHandler(){
  tabsCloseButtonHandler()
  if(!inputAddress.value){
    alert('Пожалуйста, укажите адрес!')
    return
  }
  const blocks = document.querySelectorAll('.added-block')
  const garbageArr = []
  let poligonsForRequest = []
  for(let i = 0; i < blocks.length; i++){
    const garbage = blocks[i].querySelector('#wasteInput')
    const volume = blocks[i].querySelector('#volume')
    if(!volume.value){
      alert('Пожалуйста, укажите объем!')
      return
    }
    if(!garbage.value){
      alert('Пожалуйста, укажите тип мусора!')
      return
    }
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
  // точка
  const newPoligons = await requestDistantsToPoligons(poligonsForRequest)
  console.log(garbageArr)
  garbageArr.forEach(elem => {
    tabData.push({
      id: elem['Тип мусора'],
      title: elem['Тип мусора'],
      tableData: elem.poligons.map(poligon => {
        const findedDistance = newPoligons.find(el => el.address === poligon.address).distance
        const typeOfGarbage = poligon.typeOfGarbageForPoligon.find(el => el.name === elem['Тип мусора'])
        const unit = elem['Единица измерения']
        const pricePerUnit = unit === 'ton' ? typeOfGarbage.tonPrice : typeOfGarbage.cubicPrice
        const pricePerUtilization = elem['Утилизация'] ? poligon.priceForDisposal : 0
        const price = findedDistance * elem['Объем'] * pricePerUnit + pricePerUtilization
        return {
          col1: {title: poligon.name, value: poligon.address},
          col2: {title: 'До полигона', value: findedDistance + ' км'},
          col3: {title: price + ' ₽', value: ''}
        }
      })
    })
  })
  tabsInit()
}

async function loadData(){
  const sheetId = '1dJZ85T_czTLk1GXcElLvrerAFhCbOszvvoT0vmar1-Y' // id таблицы google из url
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`

  try {
    const response = await fetch(url);
    const text = await response.text();
    const json = JSON.parse(text.substring(47).slice(0, -2)); // убираем обёртку Google
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
  if(tabData.length) closeButton.style.display = 'block'
  tabData.forEach((tab, index) => {
    // Таб
    const tabElement = document.createElement("div");
    tabElement.classList.add("tab");
    if (index === 0) tabElement.classList.add("active");
    tabElement.setAttribute("data-tab", tab.id);
    tabElement.textContent = tab.title;
    tabsContainer.appendChild(tabElement);
  
    // Таблица с данными
    const tableElement = document.createElement("table");
    tableElement.classList.add("tab-table");
  
    // Заголовки таблицы
    // const headerRow = document.createElement("tr");
    // ["Столбец 1", "Столбец 2", "Столбец 3"].forEach(header => {
    //   const th = document.createElement("th");
    //   th.textContent = header;
    //   headerRow.appendChild(th);
    // });
    // tableElement.appendChild(headerRow);
  
    // Данные таблицы
    tab.tableData.forEach((rowData) => {
      const row = document.createElement("tr");
      Object.values(rowData).forEach((cellData, idx) => {
        const td = document.createElement("td");
        if(idx !== 2){
          const h4 = document.createElement("h4")
          h4.textContent = cellData.title
          td.appendChild(h4)
          const span = document.createElement("span")
          span.textContent = cellData.value
          td.appendChild(span)
        } else {
          const h3 = document.createElement("h3")
          h3.textContent = cellData.title
          td.appendChild(h3)
        }
        row.appendChild(td)
      });
      tableElement.appendChild(row);
    });
  
    // Контент для таба
    const contentElement = document.createElement("div");
    contentElement.classList.add("tab-content");
    if (index === 0) contentElement.classList.add("active");
    contentElement.id = tab.id;
    contentElement.appendChild(tableElement);
    contentsContainer.appendChild(contentElement);
  });
  
  // Навешиваем обработчики для табов
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Убираем активные классы
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  
      // Активируем выбранный таб
      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');
    });
  });
}

function tabsCloseButtonHandler(){
  tabData = []
  tabsContainer.innerHTML = ''
  contentsContainer.innerHTML = ''
  closeButton.style.display = 'none'
}

inputGarbageAddEvent(input, suggestionsBox)
inputAddressAddEvent(inputAddress, suggestionsAddressContainer)

tabsInit()


