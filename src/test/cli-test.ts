// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See LICENSE in the project root for license information.
import { avocado, UnifiedPipelineReport } from './../index'
import * as fs from 'fs'

import { cli } from '../index'
import * as assert from 'assert'
import * as ai from '@ts-common/async-iterator'
import * as path from 'path'
import { IErrorBase } from '../errors'

describe('cli', () => {
  type MyError = { readonly message: string } & IErrorBase

  it('no errors, default output', async () => {
    // tslint:disable-next-line:no-let
    let cwd: unknown
    await cli.run(c => {
      cwd = c.cwd
      return ai.fromSequence<IErrorBase>()
    })
    assert.strictEqual(cwd, path.resolve('./'))
    assert.strictEqual(process.exitCode, 0)
  })
  it('no errors', async () => {
    // tslint:disable-next-line:no-let
    let error = ''
    // tslint:disable-next-line:no-let
    let info = ''
    const report: cli.Report = {
      logError: s => (error += s),
      logResult: s => (error += s),
      logInfo: s => (info += s),
    }
    await cli.run(() => ai.fromSequence<IErrorBase>(), report)
    assert.strictEqual(process.exitCode, 0)
    assert.strictEqual(error, '')
    assert.strictEqual(info, 'errors: 0')
  })
  it('with errors', async () => {
    // tslint:disable-next-line:no-let
    let error = ''
    // tslint:disable-next-line:no-let
    let info = ''
    const report: cli.Report = {
      logResult: s => (error += JSON.stringify(s)),
      logError: s => (error += s),
      logInfo: s => (info += s),
    }
    await cli.run(
      () =>
        ai.fromSequence<MyError>(
          ...Array<MyError>({ level: 'Error', message: 'some error' }),
        ),
      report,
    )
    assert.strictEqual(process.exitCode, 1)
    assert.strictEqual(error, '{"level":"Error","message":"some error"}')
    assert.strictEqual(info, 'errors: 1')
  })
  it('with warnings', async () => {
    // tslint:disable-next-line:no-let
    let error = ''
    // tslint:disable-next-line:no-let
    let info = ''
    const report: cli.Report = {
      logResult: s => (error += JSON.stringify(s)),
      logError: s => (error += s),
      logInfo: s => (info += s),
    }
    await cli.run(
      () =>
        ai.fromSequence<MyError>(
          ...Array<MyError>({ level: 'Warning', message: 'some error' }),
        ),
      report,
    )
    assert.strictEqual(process.exitCode, 0)
    assert.strictEqual(error, '{"level":"Warning","message":"some error"}')
    assert.strictEqual(info, 'errors: 0')
  })
  it('internal error: undefined error level', async () => {
    // tslint:disable-next-line:no-let
    let error = ''
    // tslint:disable-next-line:no-let
    let info = ''
    const report: cli.Report = {
      logResult: s => (error += JSON.stringify(s)),
      logError: s => (error += JSON.stringify(s)),
      logInfo: s => (info += s),
    }
    // tslint:disable-next-line: no-any
    await cli.run(
      () =>
        ai.fromSequence(
          ...Array<any>({ level: 'hint', message: 'some error' }),
        ),
      report,
    )
    assert.strictEqual(process.exitCode, 1)
    console.log(JSON.stringify(error))
    assert.strictEqual(error, '{"level":"hint","message":"some error"}')
    assert.strictEqual(info, 'errors: 1')
  })
  it('internal error', async () => {
    // tslint:disable-next-line:no-let
    let error = ''
    // tslint:disable-next-line:no-let
    let info = ''
    const report: cli.Report = {
      logResult: s => (error += s),
      logError: s => (error += s),
      logInfo: s => (info += s),
    }
    const f = () => {
      // tslint:disable-next-line:no-throw
      throw new Error('critical error')
    }
    await cli.run(f, report)
    assert.strictEqual(process.exitCode, 1)
    assert.strictEqual(info, 'INTERNAL ERROR')
  })

  it('test unified pipeline report result log with warning', async () => {
    // tslint:disable-next-line: no-object-mutation
    process.env.SYSTEM_PULLREQUEST_TARGETBRANCH = 'master'
    // tslint:disable-next-line: no-object-mutation
    process.env.TRAVIS_REPO_SLUG = 'Azure/azure-rest-api-specs'
    // tslint:disable-next-line: no-object-mutation
    process.env.TRAVIS_PULL_REQUEST_SHA = '70ac08dc9a'
    console.log(process.env)
    await cli.run(avocado, UnifiedPipelineReport('pipe.log'), { cwd: 'src/test/circular_reference', env: {} })
    const expected = {
      code: 'CIRCULAR_REFERENCE',
      message: 'The JSON file has a circular reference.',
      readMeUrl:
        // tslint:disable-next-line: max-line-length
        'https://github.com/Azure/azure-rest-api-specs/blob/70ac08dc9a/src/test/circular_reference/specification/testRP/readme.md',
      jsonUrl:
        // tslint:disable-next-line: max-line-length
        'https://github.com/Azure/azure-rest-api-specs/blob/70ac08dc9a/src/test/circular_reference/specification/testRP/specs/c.json',
      level: 'Warning',
    }
    const actual: any = JSON.parse(fs.readFileSync('pipe.log', 'utf8'))
    assert.deepStrictEqual(expected.code, actual.code)
    assert.deepStrictEqual(expected.message, actual.message)
    fs.unlinkSync('pipe.log')
  })

  it('test unified pipeline report result log', async () => {
    // tslint:disable-next-line: no-object-mutation
    process.env.SYSTEM_PULLREQUEST_TARGETBRANCH = 'master'
    await cli.run(avocado, UnifiedPipelineReport('pipe.log'), { cwd: 'src/test/api_version_inconsistent', env: {} })
    const expected = {
      code: 'INCONSISTENT_API_VERSION',
      level: 'Error',
      message: 'The API version of the swagger is inconsistent with its file path.',
      jsonUrl:
        // tslint:disable-next-line: max-line-length
        'https://github.com/Azure/azure-rest-api-specs/blob/70ac08dc9a/src/test/api_version_inconsistent/specification/testRP/specs/2020-05-01/b.json',
      readMeUrl:
        // tslint:disable-next-line: max-line-length
        'https://github.com/Azure/azure-rest-api-specs/blob/70ac08dc9a/src/test/api_version_inconsistent/specification/testRP/readme.md',
    }
    const actual: any = JSON.parse(fs.readFileSync('pipe.log', 'utf8'))
    assert.deepStrictEqual(expected.code, actual.code)
    assert.deepStrictEqual(expected.message, actual.message)
    fs.unlinkSync('pipe.log')
  })
  it('test unified pipeline report error log', async () => {
    await cli.run(() => {
      throw new Error('unknown error')
    }, UnifiedPipelineReport('error.log'))
    const str = fs.readFileSync('error.log', 'utf8')
    console.log(str)
    const actual: any = JSON.parse(fs.readFileSync('error.log', 'utf8'))
    assert.deepStrictEqual(actual.type, 'Raw')
    assert.ok(actual.message.includes('Error: unknown error'))
    fs.unlinkSync('error.log')
  })

  it('test unified pipeline report no file log', async () => {
    await cli.run(() => {
      throw new Error('unknown error')
    }, UnifiedPipelineReport(undefined))
    await cli.run(avocado, UnifiedPipelineReport(undefined), { cwd: 'src/test/api_version_inconsistent', env: {} })
  })
})
