import { add } from './math'

declare global {
  var testData: any
  var testCache: any
  var testCounter: number
  var pendingPromises: Promise<any>[]
  var testNodes: any[]
}

describe('Leaky test simulation', () => {
  // Global variables that will leak
  let globalTimer
  let globalEventListeners = []

  test('memory leak test - global variables', () => {
    // Create global variables (memory leak)
    global.testData = Array.from({ length: 1000000 }).fill('leak') // Large array
    global.testCache = { data: 'this will leak' }
    global.testCounter = (global.testCounter || 0) + 1

    expect(add(2, 3)).toBe(5)

    // Don't clean up globals (this causes the leak)
    // Should do: delete global.testData; delete global.testCache;
  })

  test('timer leak test', () => {
    // Create timers but don't clean them up
    globalTimer = setTimeout(() => {
      console.log('This timer should have been cleared')
    }, 10000)

    const _interval = setInterval(() => {
      console.log('This interval should have been cleared')
    }, 5000)

    expect(add(1, 1)).toBe(2)

    // Don't clean up timers (this causes the leak)
    // Should do: clearTimeout(globalTimer); clearInterval(interval);
  })

  test('event listener leak test', () => {
    // Simulate adding event listeners without cleanup
    const mockElement = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }

    // Add multiple event listeners
    for (let i = 0; i < 5; i++) {
      const handler = () => console.log(`Handler ${i}`)
      mockElement.addEventListener('click', handler)
      globalEventListeners.push({
        element: mockElement,
        type: 'click',
        handler,
      })
    }

    expect(add(3, 4)).toBe(7)

    // Don't remove event listeners (this causes the leak)
    // Should do: globalEventListeners.forEach(({element, type, handler}) =>
    //   element.removeEventListener(type, handler));
  })

  test('promise leak test', () => {
    // Create promises that might not resolve
    const pendingPromises = []

    for (let i = 0; i < 10; i++) {
      const promise = new Promise((resolve) => {
        // Some promises never resolve (memory leak)
        if (i % 3 === 0) {
          setTimeout(resolve, 30000) // Very long timeout
        } else {
          setTimeout(resolve, 10)
        }
      })
      pendingPromises.push(promise)
    }

    global.pendingPromises = pendingPromises

    expect(add(5, 6)).toBe(11)

    // Don't clean up promises (this causes the leak)
    // Should do: cancel promises or set timeout to clear them
  })

  test('well-behaved test', () => {
    // This test properly cleans up after itself
    const _localData = Array.from({ length: 100 }).fill('temporary')
    const timeout = setTimeout(() => {}, 100)

    expect(add(7, 8)).toBe(15)

    // Clean up properly
    clearTimeout(timeout)
    // localData will be garbage collected automatically
  })

  test('DOM-like leak test', () => {
    // Simulate DOM node creation without cleanup
    const mockNodes = []

    for (let i = 0; i < 20; i++) {
      const node = {
        id: `test-node-${i}`,
        children: [],
        parent: null,
        data: Array.from({ length: 1000 }).fill(`node-${i}-data`),
      }
      mockNodes.push(node)
    }

    // Add to global scope (memory leak)
    global.testNodes = (global.testNodes || []).concat(mockNodes)

    expect(add(9, 10)).toBe(19)

    // Don't clean up DOM nodes (this causes the leak)
    // Should do: delete global.testNodes or remove nodes individually
  })
})
