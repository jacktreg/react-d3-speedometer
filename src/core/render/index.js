import { line as d3Line, curveMonotoneX as d3CurveMonotoneX } from 'd3-shape'
import { select as d3Select } from 'd3-selection'
import { transition } from 'd3-transition'

import isEmpty from 'lodash-es/isEmpty'
import isArray from 'lodash-es/isArray'

import {
  centerTranslation,
  getRadius,
  calculateNeedleHeight,
  formatCurrentValueText,
  sumArrayTill,
} from '../util'
import { getNeedleTransition } from '../util/get-needle-transition'
import {
  configureArc,
  configureTicks,
  configureTickData,
  configureScale,
} from '../config/configure'

// ref: https://stackoverflow.com/a/64596738/1410291
function constructTransition({ duration, ease }) {
  return transition().duration(duration).ease(ease)
}

export const update = ({ d3_refs, newValue, config }) => {
  const scale = configureScale(config)
  const ratio = scale(newValue)
  const range = config.maxAngle - config.minAngle

  const newAngle = config.minAngle + ratio * range
  // update the pointer
  d3_refs.pointer
    .transition(
      constructTransition({
        duration: config.needleTransitionDuration,
        ease: getNeedleTransition(config.needleTransition),
      })
    )
    .attr('transform', `rotate(${newAngle})`)

  d3_refs.current_value_text.text(formatCurrentValueText(newValue, config))
}

export const render = ({ container, config }) => {
  const r = getRadius(config)
  const centerTx = centerTranslation(
    r,
    config.paddingHorizontal,
    config.paddingVertical
  )

  const svg = _renderSVG({ container, config })

  _renderArcs({ config, svg, centerTx })
  _renderLabels({ config, svg, centerTx, r })

  return {
    current_value_text: _renderCurrentValueText({ config, svg }),
    pointer: _renderNeedle({ config, svg, r, centerTx }),
  }
}

// helper function to render individual parts of gauge
function _renderSVG({ container, config }) {
  // calculate width and height
  const width = config.width + 2 * config.paddingHorizontal
  const height = config.height + 2 * config.paddingVertical

  return (
    d3Select(container)
      .append('svg:svg')
      .attr('class', 'speedometer')
      .attr('width', `${width}${config.dimensionUnit}`)
      .attr('height', `${height}${config.dimensionUnit}`)
      .attr('role', 'img')
      .attr('focusable', 'false')
      .attr('aria-label', config.svgAriaLabel)
      // use inline styles so that width/height is not overridden
      .style('width', `${width}${config.dimensionUnit}`)
      .style('height', `${height}${config.dimensionUnit}`)
  )
}

function _renderArcs({ config, svg, centerTx }) {
  const tickData = configureTickData(config)
  const arc = configureArc(config)

  let arcs = svg.append('g').attr('class', 'arc').attr('transform', centerTx)

  arcs
    .selectAll('path')
    .data(tickData)
    .enter()
    .append('path')
    .attr('class', 'speedo-segment')
    .attr('fill', (d, i) => {
      // if custom segment colors is present just use it
      if (!isEmpty(config.segmentColors) && config.segmentColors[i]) {
        return config.segmentColors[i]
      }

      return config.arcColorFn(d * i)
    })
    .attr('d', arc)
    .style('stroke', config.segmentSeparatorColor)
    .style('stroke-width', 2)
}

export function _renderLabels({ config, svg, centerTx, r }) {
  const ticks = configureTicks(config)
  const tickData = configureTickData(config)
  const scale = configureScale(config)
  const range = config.maxAngle - config.minAngle

  // Add optimal value label and tick mark if configured
  if (config.showOptimalValue && config.optimalValue != null) {
    const optimalRatio = scale(config.optimalValue)
    const optimalAngle = config.minAngle + optimalRatio * range
    
    const optimalLabel = svg.append('g')
      .attr('class', 'label optimal-label')
      .attr('transform', centerTx)

    // Add optimal value tick mark
    optimalLabel
      .append('line')
      .attr('transform', `rotate(${optimalAngle})`)
      .attr('x1', 0)
      .attr('y1', config.labelInset - r - 2)
      .attr('x2', 0)
      .attr('y2', config.labelInset - r + 12)
      .style('stroke', config.optimalValueColor)
      .style('stroke-width', 2)

    // Add optimal value label
    optimalLabel
      .append('text')
      .attr('transform', `rotate(${optimalAngle}) translate(0, ${config.labelInset - r - config.labelTickPadding})`)
      .text(config.segmentValueFormatter(config.labelFormat(config.optimalValue)))
      .attr('class', 'segment-value optimal-value')
      .style('text-anchor', 'middle')
      .style('font-size', config.labelFontSize)
      .style('font-weight', 'bold')
      .style('fill', config.optimalValueColor)
  }

  // assuming we have the custom segment labels here
  const { customSegmentLabels } = config

  const isCustomLabelsPresent =
    isArray(customSegmentLabels) && !isEmpty(customSegmentLabels)
  const isCustomLabelsValid =
    isCustomLabelsPresent && customSegmentLabels.length === tickData.length

  // if custom labels present and not valid
  if (isCustomLabelsPresent && !isCustomLabelsValid) {
    throw new Error(
      `Custom Segment Labels should be an array with length of ${tickData.length}`
    )
  }

  // we have valid custom labels
  if (isCustomLabelsPresent && isCustomLabelsValid) {
    _renderCustomSegmentLabels({
      config,
      svg,
      centerTx,
      r,
      ticks,
      tickData,
      scale,
      range,
    })
    if (!config.showStopsAndCustomSegmentLabels) {
      return
    }
  }

  // normal label rendering
  let lg = svg.append('g').attr('class', 'label').attr('transform', centerTx)

  // Add tick marks
  lg.selectAll('line')
    .data(ticks)
    .enter()
    .append('line')
    .attr('transform', (d, i) => {
      const ratio =
        config.customSegmentStops.length === 0
          ? scale(d)
          : sumArrayTill(tickData, i)

      const newAngle = config.minAngle + ratio * range

      return `rotate(${newAngle})`
    })
    .attr('x1', 0)
    .attr('y1', config.labelInset - r - 2)
    .attr('x2', 0)
    .attr('y2', config.labelInset - r + 12)
    .style('stroke', config.textColor)
    .style('stroke-width', 2)

  // Existing label text rendering
  lg.selectAll('text')
    .data(ticks)
    .enter()
    .append('text')
    .attr('transform', (d, i) => {
      const ratio =
        config.customSegmentStops.length === 0
          ? scale(d)
          : sumArrayTill(tickData, i)

      const newAngle = config.minAngle + ratio * range

      return `rotate(${newAngle}) translate(0, ${config.labelInset - r - config.labelTickPadding})`
    })
    .text(value => {
      // Return empty string if this value matches the optimal value
      if (config.showOptimalValue && config.optimalValue === value) {
        return ''
      }
      return config.segmentValueFormatter(config.labelFormat(value))
    })
    .attr('class', 'segment-value')
    .style('text-anchor', 'middle')
    .style('font-size', config.labelFontSize)
    .style('font-weight', 'bold')
    .style('fill', (d, i) => {
      if (config.segmentLabelColors && config.segmentLabelColors[i]) {
        return config.segmentLabelColors[i]
      }
      return config.arcColorFn(scale(d))
    })
}

// helper function to render 'custom segment labels'
function _renderCustomSegmentLabels({
  config,
  svg,
  centerTx,
  r,
  ticks,
  tickData,
  scale,
  range,
}) {
  const { customSegmentStops, customSegmentLabels } = config

  // helper function to calculate angle
  function _calculateAngle(d, i) {
    const ratio =
      customSegmentStops.length === 0 ? scale(d) : sumArrayTill(tickData, i)

    const newAngle = config.minAngle + ratio * range

    return newAngle
  }

  // calculate the angles ([avg of range angles])
  const newAngles = customSegmentLabels.map((label, i) => {
    const curr_index = i
    const next_index = i + 1

    const d1 = ticks[curr_index]
    const angle1 = _calculateAngle(d1, curr_index)

    const d2 = ticks[next_index]
    const angle2 = _calculateAngle(d2, next_index)

    return (angle2 + angle1) / 2
  })

  const innerRadius = r - config.ringWidth - config.ringInset
  const outerRadius = r - config.ringInset

  const position = outerRadius - (outerRadius - innerRadius) / 2

  let lg;
  if (config.showSegmentLabelsOnlyOnHover) {
    lg = svg.append('g')
      .attr('class', 'label custom-segment-labels')
      .attr('transform', centerTx)
      .style('opacity', 0) // Start with labels hidden

    // Add hover events to the parent SVG
    svg
      .on('mouseenter', () => {
        lg.style('opacity', 1)
          .style('transition', 'opacity 0.2s ease-in-out')
      })
      .on('mouseleave', () => {
        lg.style('opacity', 0)
          .style('transition', 'opacity 0.2s ease-in-out')
      })
  } else {
    lg = svg.append('g').attr('class', 'label').attr('transform', centerTx)
  }

  lg.selectAll('text')
    .data(customSegmentLabels)
    .enter()
    .append('text')
    .attr('transform', (d, i) => {
      const newAngle = newAngles[i]

      const outerText = `rotate(${newAngle}) translate(0, ${
        config.labelInset - r
      })`
      const innerText = `rotate(${newAngle}) translate(0, ${
        config.labelInset / 2 - position
      })`

      // by default we will show "INSIDE"
      return d.position === 'OUTSIDE' ? outerText : innerText
    })
    .text(d => d.text || '')
    // add class for text label
    .attr('class', 'segment-value')
    // styling stuffs
    .style('text-anchor', 'middle')
    .style('font-size', d => d.fontSize || config.labelFontSize)
    .style('font-weight', 'bold')
    .style('fill', d => d.color || config.textColor)

  // depending on INSIDE/OUTSIDE config calculate the position/rotate/translate

  // utilise the color/fontSize configs
}

function _renderCurrentValueText({ config, svg }) {
  const translateX = (config.width + 2 * config.paddingHorizontal) / 2
  // move the current value text down depending on padding vertical
  const translateY = (config.width + 4 * config.paddingVertical) / 2

  return (
    svg
      .append('g')
      .attr('transform', `translate(${translateX}, ${translateY})`)
      .append('text')
      // add class for the text
      .attr('class', 'current-value')
      .attr('text-anchor', 'middle')
      // position the text 23pt below
      .attr('y', 23)
      // add text
      .text(config.currentValue)
      .style('font-size', config.valueTextFontSize)
      .style('font-weight', config.valueTextFontWeight)
      .style('fill', config.textColor)
  )
}

function _renderNeedle({ config, svg, r, centerTx }) {
  const needleLength = calculateNeedleHeight({
    heightRatio: config.needleHeightRatio,
    radius: r,
  })

  const lineData = [
    [config.pointerWidth / 2, 0],
    [0, -needleLength],
    [-(config.pointerWidth / 2), 0],
    [0, config.pointerTailLength],
    [config.pointerWidth / 2, 0],
  ]

  const pointerLine = d3Line().curve(d3CurveMonotoneX)

  let pg = svg
    .append('g')
    .data([lineData])
    .attr('class', 'pointer')
    .attr('transform', centerTx)
    .style('fill', config.needleColor)

  return pg
    .append('path')
    .attr('d', pointerLine)
    .attr('transform', `rotate(${config.minAngle})`)
}
