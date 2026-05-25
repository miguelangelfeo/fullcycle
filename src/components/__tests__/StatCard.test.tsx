import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatCard } from '../StatCard'

describe('StatCard Component', () => {
  it('renders title and value correctly', () => {
    render(
      <StatCard 
        title="Ingresos Totales" 
        value="$1,500" 
        icon={<svg data-testid="test-icon" />} 
      />
    )
    
    expect(screen.getByText('Ingresos Totales')).toBeInTheDocument()
    expect(screen.getByText('$1,500')).toBeInTheDocument()
    expect(screen.getByTestId('test-icon')).toBeInTheDocument()
  })

  it('renders subtitle if provided', () => {
    render(
      <StatCard 
        title="Gastos" 
        value="$500" 
        subtitle="Mes actual"
        icon={<div />} 
      />
    )
    
    expect(screen.getByText('Mes actual')).toBeInTheDocument()
  })

  it('renders trend correctly for positive values', () => {
    render(
      <StatCard 
        title="Usuarios" 
        value="150" 
        trend={{ value: 10, label: 'vs mes pasado' }}
        icon={<div />} 
      />
    )
    
    expect(screen.getByText('↑ 10% vs mes pasado')).toBeInTheDocument()
    expect(screen.getByText('↑ 10% vs mes pasado')).toHaveClass('text-success')
  })

  it('renders trend correctly for negative values', () => {
    render(
      <StatCard 
        title="Bajas" 
        value="5" 
        trend={{ value: -2, label: 'vs mes pasado' }}
        icon={<div />} 
      />
    )
    
    expect(screen.getByText('↓ 2% vs mes pasado')).toBeInTheDocument()
    expect(screen.getByText('↓ 2% vs mes pasado')).toHaveClass('text-destructive')
  })
})
