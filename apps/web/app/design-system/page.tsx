"use client"

import { useState } from "react"
import { PageLayout, Header, Section } from "@/components/layouts"
import { FeatureGrid, type FeatureItem, IconWrapper } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FloatingInput } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Shield,
  Server,
  Brain,
  Code2,
  ArrowRight
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"

// Example page demonstrating the new design system
export default function ExamplePage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')

  const features: FeatureItem[] = [
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Secure",
      description: "Enterprise-grade security with encryption",
      iconVariant: "primary"
    },
    {
      icon: <Server className="h-6 w-6" />,
      title: "Self-Hosted",
      description: "Complete control over your data",
      iconVariant: "default"
    },
    {
      icon: <Brain className="h-6 w-6" />,
      title: "AI-Powered",
      description: "Intelligent deployment automation",
      iconVariant: "secondary"
    }
  ]

  const headerActions = (
    <>
      <Link href="/design-system">
        <Button variant="ghost" size="sm">
          <Code2 className="h-4 w-4 mr-2" />
          Design System
        </Button>
      </Link>
      <Button variant="outline" size="sm">
        Settings
      </Button>
    </>
  )

  return (
    <PageLayout background="ocean">
      <Header
        title="DXLander"
        subtitle="Example Page"
        badge="Demo"
        actions={headerActions}
      />

      {/* Hero Section */}
      <Section spacing="xl" variant="hero">
        <div className="max-w-4xl mx-auto">
          <div className="mx-auto mb-6 w-16 h-16 flex items-center justify-center">
            <Image
              src="/logo.svg"
              alt="DXLander"
              width={64}
              height={64}
              className="h-16 w-16"
            />
          </div>
          <h1 className="text-4xl font-bold mb-4 text-gray-900">
            Welcome to <span className="text-gradient-ocean">DXLander</span>
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Your AI-powered deployment automation platform. This example demonstrates
            our consistent design system patterns.
          </p>
          <Button size="lg" className="group">
            Get Started
            <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
      </Section>

      {/* Features Section */}
      <Section spacing="lg" background="subtle">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Key Features</h2>
            <p className="text-gray-600">Built with consistency and elegance in mind</p>
          </div>

          <FeatureGrid features={features} columns={3} gap="lg" />
        </div>
      </Section>

      {/* Form Example Section */}
      <Section spacing="lg">
        <div className="max-w-2xl mx-auto">
          <Card variant="elevated">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Stay Updated</CardTitle>
              <CardDescription>
                Subscribe to get notified about new features and updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FloatingInput
                    label="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <FloatingInput
                    label="Email Address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button className="w-full">
                  Subscribe to Updates
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Status Cards Example */}
      <Section spacing="lg" background="gradient">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center text-gray-900">
            System Status
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card variant="interactive" className="cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Projects
                </CardTitle>
                <IconWrapper variant="default" size="sm">
                  <Code2 className="h-4 w-4" />
                </IconWrapper>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-ocean-700">12</div>
                <p className="text-xs text-gray-600">
                  +2 from last month
                </p>
              </CardContent>
            </Card>

            <Card variant="interactive" className="cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Deployments
                </CardTitle>
                <IconWrapper variant="primary" size="sm">
                  <Server className="h-4 w-4" />
                </IconWrapper>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-ocean-700">847</div>
                <p className="text-xs text-gray-600">
                  +12% from last week
                </p>
              </CardContent>
            </Card>

            <Card variant="interactive" className="cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Success Rate
                </CardTitle>
                <IconWrapper variant="secondary" size="sm">
                  <Shield className="h-4 w-4" />
                </IconWrapper>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-ocean-700">99.2%</div>
                <p className="text-xs text-gray-600">
                  Excellent performance
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </Section>

      {/* CTA Section */}
      <Section spacing="xl" variant="centered">
        <div className="max-w-2xl mx-auto">
          <Card variant="gradient" className="text-center">
            <CardContent className="pt-6">
              <h3 className="text-xl font-bold mb-2 text-gray-900">
                Ready to get started?
              </h3>
              <p className="text-gray-600 mb-6">
                Join thousands of developers using DXLander for their deployment needs.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg">
                  Start Free Trial
                </Button>
                <Button variant="outline" size="lg">
                  View Documentation
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>
    </PageLayout>
  )
}